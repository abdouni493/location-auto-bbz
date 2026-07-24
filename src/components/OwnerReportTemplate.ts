import type { Car, VehicleExpense } from '../types';
import type { CarBenefits } from '../utils/carBenefits';

/**
 * Rapport imprimable destiné au PROPRIÉTAIRE d'un véhicule en gestion.
 *
 * ⚠️ Règle absolue : ce document ne doit JAMAIS révéler la part de l'agence.
 * On n'imprime donc ni `agencyBenefit`, ni `agencyDailyShare`, ni le total
 * encaissé — chaque location est présentée avec le seul montant qui revient au
 * propriétaire (`ownerShare`). Sans le total client, la part de l'agence n'est
 * pas déductible par soustraction.
 */

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (n: number): string =>
  `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} DA`;

const shortDate = (d?: string): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR');
  } catch {
    return d;
  }
};

interface AgencyInfo {
  name?: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export const generateOwnerReportHTML = (
  car: Car,
  benefits: CarBenefits,
  startDate: string,
  endDate: string,
  agency: AgencyInfo,
  lang: 'fr' | 'ar' = 'fr'
): string => {
  const T = (fr: string, ar: string) => (lang === 'fr' ? fr : ar);

  const agencyName = agency?.name || 'MHD AUTO';
  const printedOn = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Locations : uniquement la part du propriétaire ──────────────────────
  const rentalRows = benefits.lines.length
    ? benefits.lines
        .map(
          (l, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${esc(l.clientName)}</td>
          <td>${shortDate(l.departureDate)}</td>
          <td>${shortDate(l.returnDate)}</td>
          <td class="num">${l.days}</td>
          <td class="num strong">${money(l.ownerShare)}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="6" class="empty">${T(
        'Aucune location sur cette période.',
        'لا توجد إيجارات في هذه الفترة.'
      )}</td></tr>`;

  const expenseRows = benefits.expenses.length
    ? benefits.expenses
        .map(
          (e: VehicleExpense, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${esc(e.expenseName || e.type || '—')}</td>
          <td>${shortDate(e.date)}</td>
          <td>${esc(e.note || '—')}</td>
          <td class="num strong neg">− ${money(Number(e.cost) || 0)}</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="empty">${T(
        'Aucune dépense sur cette période.',
        'لا توجد مصاريف في هذه الفترة.'
      )}</td></tr>`;

  // Revenu du propriétaire AVANT déduction des dépenses.
  const ownerGross = benefits.lines.reduce((s, l) => s + l.ownerShare, 0);
  const ownerNet = benefits.ownerBenefit;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8" />
<title>${T('Rapport propriétaire', 'تقرير المالك')} — ${esc(car.brand)} ${esc(car.model)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #14141A; margin: 0; font-size: 12px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid #B8912C; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { width: 62px; height: 62px; object-fit: contain; border-radius: 10px; }
  .brand .fallback { width: 62px; height: 62px; border-radius: 10px; background: #B8912C;
                     color: #fff; font-weight: 800; font-size: 24px;
                     display: flex; align-items: center; justify-content: center; }
  .brand h1 { margin: 0; font-size: 20px; letter-spacing: -0.4px; }
  .brand p { margin: 2px 0 0; font-size: 10.5px; color: #6B6B76; }

  .doc { text-align: ${lang === 'ar' ? 'left' : 'right'}; }
  .doc h2 { margin: 0; font-size: 15px; text-transform: uppercase;
            letter-spacing: 1.5px; color: #B8912C; }
  .doc p { margin: 3px 0 0; font-size: 10.5px; color: #6B6B76; }

  .period { background: #FBF6E9; border: 1px solid #E6D5A8; border-radius: 8px;
            padding: 10px 14px; margin-bottom: 18px; font-size: 11.5px; font-weight: 600; }

  .grid { display: flex; gap: 14px; margin-bottom: 18px; }
  .panel { flex: 1; border: 1px solid #E2E2E8; border-radius: 8px; padding: 12px 14px; }
  .panel h3 { margin: 0 0 8px; font-size: 10px; text-transform: uppercase;
              letter-spacing: 1.2px; color: #B8912C; }
  .panel .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11.5px; }
  .panel .row span:first-child { color: #6B6B76; }
  .panel .row span:last-child { font-weight: 600; }

  h4.section { margin: 20px 0 8px; font-size: 11px; text-transform: uppercase;
               letter-spacing: 1.4px; color: #14141A;
               border-${lang === 'ar' ? 'right' : 'left'}: 3px solid #B8912C;
               padding-${lang === 'ar' ? 'right' : 'left'}: 8px; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #14141A; color: #fff; text-align: ${lang === 'ar' ? 'right' : 'left'};
             padding: 7px 9px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.8px; }
  tbody td { padding: 7px 9px; border-bottom: 1px solid #ECECF1; }
  tbody tr:nth-child(even) { background: #FAFAFC; }
  .num { text-align: ${lang === 'ar' ? 'left' : 'right'}; white-space: nowrap; }
  .strong { font-weight: 700; }
  .neg { color: #C0392B; }
  .empty { text-align: center; color: #9A9AA4; font-style: italic; padding: 14px; }

  .totals { margin-top: 18px; border: 2px solid #B8912C; border-radius: 10px; overflow: hidden; }
  .totals .line { display: flex; justify-content: space-between;
                  padding: 9px 16px; font-size: 12px; border-bottom: 1px solid #EFE4C6; }
  .totals .line span:last-child { font-weight: 700; }
  .totals .final { background: #14141A; color: #fff; padding: 14px 16px;
                   display: flex; justify-content: space-between; align-items: center; }
  .totals .final span:first-child { font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; }
  .totals .final span:last-child { font-size: 20px; font-weight: 800; color: #E3BE5C; }

  .signs { display: flex; justify-content: space-between; margin-top: 34px; }
  .sign { width: 44%; text-align: center; }
  .sign .line { border-top: 1px solid #14141A; margin-top: 46px; padding-top: 5px;
                font-size: 10px; color: #6B6B76; }

  footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #E2E2E8;
           font-size: 9.5px; color: #9A9AA4; text-align: center; }

  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>

  <div class="head">
    <div class="brand">
      ${
        agency?.logo
          ? `<img src="${esc(agency.logo)}" alt="" />`
          : `<div class="fallback">${esc(agencyName.charAt(0).toUpperCase())}</div>`
      }
      <div>
        <h1>${esc(agencyName)}</h1>
        ${agency?.address ? `<p>${esc(agency.address)}</p>` : ''}
        ${agency?.phone ? `<p>${T('Tél', 'الهاتف')} : ${esc(agency.phone)}</p>` : ''}
        ${agency?.email ? `<p>${esc(agency.email)}</p>` : ''}
      </div>
    </div>
    <div class="doc">
      <h2>${T('Rapport propriétaire', 'تقرير المالك')}</h2>
      <p>${T('Édité le', 'حُرر في')} ${printedOn}</p>
    </div>
  </div>

  <div class="period">
    ${T('Période du', 'الفترة من')} <strong>${shortDate(startDate)}</strong>
    ${T('au', 'إلى')} <strong>${shortDate(endDate)}</strong>
  </div>

  <div class="grid">
    <div class="panel">
      <h3>${T('Véhicule', 'المركبة')}</h3>
      <div class="row"><span>${T('Marque / Modèle', 'العلامة / الطراز')}</span><span>${esc(car.brand)} ${esc(car.model)}</span></div>
      <div class="row"><span>${T('Immatriculation', 'رقم التسجيل')}</span><span>${esc(car.registration)}</span></div>
      <div class="row"><span>${T('Année', 'السنة')}</span><span>${esc(car.year)}</span></div>
      <div class="row"><span>${T('Énergie', 'الطاقة')}</span><span>${esc(car.energy)}</span></div>
      <div class="row"><span>${T('Kilométrage', 'المسافة')}</span><span>${Number(car.mileage || 0).toLocaleString('fr-FR')} km</span></div>
    </div>
    <div class="panel">
      <h3>${T('Propriétaire', 'المالك')}</h3>
      <div class="row"><span>${T('Nom', 'الاسم')}</span><span>${esc(benefits.ownerName || '—')}</span></div>
      <div class="row"><span>${T('Téléphone', 'الهاتف')}</span><span>${esc(benefits.ownerPhone || '—')}</span></div>
      <div class="row"><span>${T('Locations', 'الإيجارات')}</span><span>${benefits.rentalsCount}</span></div>
      <div class="row"><span>${T('Jours loués', 'أيام مؤجرة')}</span><span>${benefits.totalDays}</span></div>
    </div>
  </div>

  <h4 class="section">${T('Détail des locations', 'تفاصيل الإيجارات')}</h4>
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>${T('Client', 'العميل')}</th>
        <th>${T('Départ', 'الانطلاق')}</th>
        <th>${T('Retour', 'العودة')}</th>
        <th class="num">${T('Jours', 'الأيام')}</th>
        <th class="num">${T('Montant propriétaire', 'مبلغ المالك')}</th>
      </tr>
    </thead>
    <tbody>${rentalRows}</tbody>
  </table>

  <h4 class="section">${T('Détail des dépenses', 'تفاصيل المصاريف')}</h4>
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>${T('Désignation', 'التسمية')}</th>
        <th>${T('Date', 'التاريخ')}</th>
        <th>${T('Note', 'ملاحظة')}</th>
        <th class="num">${T('Montant', 'المبلغ')}</th>
      </tr>
    </thead>
    <tbody>${expenseRows}</tbody>
  </table>

  <div class="totals">
    <div class="line">
      <span>${T('Total des locations', 'إجمالي الإيجارات')}</span>
      <span>${money(ownerGross)}</span>
    </div>
    <div class="line">
      <span>${T('Total des dépenses', 'إجمالي المصاريف')}</span>
      <span class="neg">− ${money(benefits.totalExpenses)}</span>
    </div>
    <div class="final">
      <span>${T('Net à percevoir', 'الصافي المستحق')}</span>
      <span>${money(ownerNet)}</span>
    </div>
  </div>

  <div class="signs">
    <div class="sign">
      <div class="line">${T("Cachet et signature de l'agence", 'ختم وتوقيع الوكالة')}</div>
    </div>
    <div class="sign">
      <div class="line">${T('Signature du propriétaire', 'توقيع المالك')}</div>
    </div>
  </div>

  <footer>
    ${esc(agencyName)} — ${T(
      'Document généré automatiquement. Les montants indiqués correspondent aux sommes effectivement encaissées sur la période.',
      'وثيقة مُنشأة تلقائيًا. المبالغ المذكورة تمثل ما تم تحصيله فعليًا خلال الفترة.'
    )}
  </footer>

</body>
</html>`;
};
