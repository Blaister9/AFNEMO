import YAML from 'yaml';

export function prepareAdminHtml(source, env = {}) {
  const preview = ['deploy-preview', 'branch-deploy'].includes(env.CONTEXT);
  const notice = preview
    ? 'Entorno de revisión: los cambios se guardan en esta rama de revisión. Este acceso no publica en afnemo.co.'
    : 'Acceso de publicación: guardar puede actualizar afnemo.co. Para ensayar utiliza el enlace de revisión del responsable.';
  return source.replace('<!-- CMS_ENVIRONMENT_NOTICE -->', `<p class="cms-environment-notice" role="note">${notice}</p>`);
}

// Only generated preview output changes branch. The source/production config stays on main.
export function prepareCmsConfig(source, env = {}) {
  if (!['deploy-preview', 'branch-deploy'].includes(env.CONTEXT)) return source;
  const config = YAML.parse(source);
  const branch = env.HEAD;
  if (!branch || branch === config.backend.branch || branch === 'main' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(branch)) {
    throw new Error('La preview CMS necesita HEAD de una rama de revisión distinta de producción');
  }
  const url = new URL(env.DEPLOY_PRIME_URL);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.netlify.app') || url.username || url.password || url.port) {
    throw new Error('La preview CMS necesita una URL HTTPS de Netlify');
  }
  config.backend.branch = branch;
  // Netlify exposes the same project Identity/Gateway service at the preview origin.
  // Keeping same-origin endpoints preserves the existing CSP and authentication provider.
  config.site_url = url.origin;
  config.display_url = url.origin;
  return YAML.stringify(config);
}
