import { t } from '../i18n';

const root = document.getElementById('app');
if (root) root.textContent = t('app.loading');
document.title = t('app.title');
