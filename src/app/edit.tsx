import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ScreenBackground } from '@/components/screen-background';
import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { dateInput, dateSerial, editFieldType } from '@/features/travel/edit-values';
import { clearTravelCache } from '@/features/travel/repository';
import { canEdit, editingSheets, saveCell, type EditSheet } from '@/services/remote';

export default function EditScreen() {
  const queryClient = useQueryClient();
  const [sheets, setSheets] = useState<EditSheet[]>([]);
  const [sheetId, setSheetId] = useState<number>();
  const [rowNumber, setRowNumber] = useState<number>();
  const [drafts, setDrafts] = useState<Record<number, string | boolean>>({});
  const [busy, setBusy] = useState(canEdit());
  const [error, setError] = useState('');

  async function load() {
    setBusy(true);
    setError('');
    try { setSheets(await editingSheets()); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!canEdit()) return;
    let active = true;
    editingSheets().then((items) => { if (active) setSheets(items); })
      .catch((cause) => { if (active) setError((cause as Error).message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const sheet = sheets.find((item) => item.id === sheetId);
  const row = sheet?.linhas.find((item) => item.numero === rowNumber);

  async function save(column: number) {
    if (!sheet || !row) return;
    const original = row.cells[column].valor;
    const draft = drafts[column];
    let value: string | number | boolean = draft;
    const type = editFieldType(sheet.nome, String(sheet.cabecalho[column] || ''));
    if (type === 'date' && String(draft).trim()) {
      const serial = dateSerial(String(draft));
      if (serial === null) { setError('Use uma data válida no formato AAAA-MM-DD HH:mm.'); return; }
      value = serial;
    } else if (type === 'number' || (typeof original === 'number' && type !== 'date')) {
      value = String(draft).trim() ? Number(String(draft).replace(',', '.')) : '';
      if (typeof value === 'number' && !Number.isFinite(value)) { setError('Informe um número válido.'); return; }
    }
    setBusy(true);
    setError('');
    try {
      await saveCell({ aba: sheet.id, linha: row.numero, coluna: column + 1, versao: row.versao, valor: value });
      await clearTravelCache();
      await queryClient.invalidateQueries();
      setDrafts((previous) => {
        const remaining = { ...previous };
        delete remaining[column];
        return remaining;
      });
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Editar planilha</ThemedText>
        {!canEdit() ? <ThemedText>Edição não autorizada.</ThemedText> : null}
        {busy ? <ActivityIndicator /> : null}
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        {sheet ? (
          <Pressable onPress={() => { setSheetId(undefined); setRowNumber(undefined); setDrafts({}); }}><ThemedText type="link">Todas as abas</ThemedText></Pressable>
        ) : sheets.map((item) => (
          <Pressable key={item.id} style={styles.item} onPress={() => setSheetId(item.id)}><ThemedText>{item.nome}</ThemedText></Pressable>
        ))}
        {sheet && !row ? <>
          <ThemedText type="subtitle">{sheet.nome}</ThemedText>
          {sheet.linhas.filter((item) => item.cells.some((cell) => cell.valor !== '')).map((item) => (
            <Pressable key={item.numero} style={styles.item} onPress={() => { setRowNumber(item.numero); setDrafts({}); }}>
              <ThemedText>{item.numero} · {item.cells.map((cell) => String(cell.valor)).filter(Boolean).slice(0, 3).join(' · ')}</ThemedText>
            </Pressable>
          ))}
        </> : null}
        {sheet && row ? <>
          <Pressable onPress={() => { setRowNumber(undefined); setDrafts({}); }}><ThemedText type="link">{sheet.nome} · linhas</ThemedText></Pressable>
          {row.cells.map((cell, column) => (
            <View key={column} style={styles.field}>
              <ThemedText type="smallBold">{String(sheet.cabecalho[column] || `Coluna ${column + 1}`)}</ThemedText>
              {cell.formula ? <ThemedText>{String(cell.valor)} (fórmula)</ThemedText> : <>
                {typeof cell.valor === 'boolean' || editFieldType(sheet.nome, String(sheet.cabecalho[column] || '')) === 'boolean' ? (
                  <Switch value={Boolean(drafts[column] ?? cell.valor)} onValueChange={(value) => setDrafts((prev) => ({ ...prev, [column]: value }))} />
                ) : (
                  <TextInput value={String(drafts[column] ?? (editFieldType(sheet.nome, String(sheet.cabecalho[column] || '')) === 'date' && typeof cell.valor === 'number' ? dateInput(cell.valor) : cell.valor))} onChangeText={(value) => setDrafts((prev) => ({ ...prev, [column]: value }))} placeholder={editFieldType(sheet.nome, String(sheet.cabecalho[column] || '')) === 'date' ? 'AAAA-MM-DD HH:mm' : undefined} style={styles.input} />
                )}
                {drafts[column] !== undefined && <Pressable disabled={busy} onPress={() => void save(column)}><ThemedText type="link">Salvar</ThemedText></Pressable>}
              </>}
            </View>
          ))}
        </> : null}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  item: { padding: Spacing.three, borderBottomWidth: 1, borderColor: Colors.light.border },
  field: { gap: Spacing.one, paddingVertical: Spacing.two },
  input: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 4, padding: Spacing.two, backgroundColor: '#FFFFFF', color: Colors.light.text },
  error: { color: '#B3261E' },
});