// Polices embarquées par wrangler (règle « Data » de wrangler.toml) : un ArrayBuffer.
declare module "*.ttf" {
  const contenu: ArrayBuffer;
  export default contenu;
}
