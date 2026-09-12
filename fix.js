const fs = require('fs');
let code = fs.readFileSync('src/app/finance-hub/accounts/page.tsx', 'utf8');

// Responsive fix
code = code.replace(
    '<div className="flex justify-between items-end border-t border-slate-50 pt-4">',
    '<div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 border-t border-slate-50 dark:border-slate-800 pt-4">'
);
code = code.replace(
    '<div className="flex gap-2">\\n                                                <ContractorIngredientsDialog',
    '<div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end">\\n                                                <ContractorIngredientsDialog'
);

// Second button group (Accounts)
code = code.replace(
    '<div className="flex justify-between items-end border-t border-slate-50 pt-4">',
    '<div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 border-t border-slate-50 dark:border-slate-800 pt-4">'
);

// Third button group (Companies)
code = code.replace(
    '<div className="flex justify-between items-end border-t border-slate-50 pt-4">',
    '<div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 border-t border-slate-50 dark:border-slate-800 pt-4">'
);

// Fix dark mode (use basic replacement)
code = code.replaceAll('bg-white', 'bg-card dark:bg-slate-900');
code = code.replaceAll('bg-slate-50', 'bg-slate-50 dark:bg-slate-800/50');
code = code.replaceAll('text-slate-900', 'text-slate-900 dark:text-white');
code = code.replaceAll('text-slate-800', 'text-slate-800 dark:text-slate-200');
code = code.replaceAll('border-slate-50', 'border-slate-50 dark:border-slate-800');

fs.writeFileSync('src/app/finance-hub/accounts/page.tsx', code);
