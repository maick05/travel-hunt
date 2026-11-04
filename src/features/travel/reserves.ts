export const assetKey = (asset: string) => asset.trim().toLocaleUpperCase('pt-BR');

export function hasReserveAsset(assets: string[], asset: string): boolean {
  const key = assetKey(asset);
  return !!key && assets.some((value) => assetKey(value) === key);
}