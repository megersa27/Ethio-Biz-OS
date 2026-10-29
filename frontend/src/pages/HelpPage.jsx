import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  PackageSearch,
  Settings,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function HelpPage({ onGoToDashboard, onOpenSettings }) {
  const { t } = useTranslation();

  const quickActions = [
    {
      icon: PackageSearch,
      title: t('help.quickProductsTitle'),
      text: t('help.quickProductsText'),
    },
    {
      icon: Warehouse,
      title: t('help.quickInventoryTitle'),
      text: t('help.quickInventoryText'),
    },
    {
      icon: ShoppingCart,
      title: t('help.quickSalesTitle'),
      text: t('help.quickSalesText'),
    },
    {
      icon: ClipboardList,
      title: t('help.quickReportsTitle'),
      text: t('help.quickReportsText'),
    },
  ];

  const workFlow = [
    t('help.step1'),
    t('help.step2'),
    t('help.step3'),
    t('help.step4'),
  ];

  return (
    <section className="help-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('help.eyebrow')}</p>
          <h1>{t('help.title')}</h1>
          <p>{t('help.subtitle')}</p>
        </div>
        <button className="secondary-button" onClick={onGoToDashboard}>
          <ArrowRight size={15} /> {t('common.backToDashboard')}
        </button>
      </div>

      <div className="help-grid">
        <article className="panel help-panel">
          <div className="help-panel-header">
            <BookOpen size={18} />
            <h2>{t('help.gettingStarted')}</h2>
          </div>
          <ul className="help-list">
            {workFlow.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel help-panel">
          <div className="help-panel-header">
            <BriefcaseBusiness size={18} />
            <h2>{t('help.workspaceTips')}</h2>
          </div>
          <ul className="help-list">
            <li>{t('help.tip1')}</li>
            <li>{t('help.tip2')}</li>
            <li>{t('help.tip3')}</li>
            <li>{t('help.tip4')}</li>
          </ul>
        </article>
      </div>

      <div className="help-grid help-grid-cards">
        {quickActions.map(({ icon: Icon, title, text }) => (
          <article key={title} className="panel help-card-panel">
            <div className="help-card-icon"><Icon size={18} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className="help-actions">
        <button type="button" className="primary-button" onClick={onGoToDashboard}>
          {t('help.openDashboard')}
        </button>
        <button type="button" className="secondary-button" onClick={onOpenSettings}>
          <Settings size={15} /> {t('help.businessSettings')}
        </button>
      </div>
    </section>
  );
}
