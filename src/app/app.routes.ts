import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Homepage } from './features/homepage/homepage';
import { BannerName } from './layout/site-header/site-header';
import { PagePlaceholder } from './layout/page-placeholder/page-placeholder';
import { STRINGS } from './strings/en';

/** The old start page was the encyclopedia: a link with a `#...` on the homepage goes to the encyclopedia, search included. */
const oldHomepageLink: CanActivateFn = (route) =>
  route.fragment
    ? inject(Router).createUrlTree(['/encyclopedia'], { queryParams: route.queryParams, fragment: route.fragment })
    : true;

const page = (title: string, header: string, banner: BannerName) => ({
  component: PagePlaceholder,
  title,
  data: { header, banner },
});

/**
 * `title` is the browser tab text, `data.header` the title in the page header and `data.banner` its character picture
 * (a page without them has no header). Every page but the homepage loads when it is opened: the builder and the core are big.
 */
export const routes: Routes = [
  {
    path: '',
    component: Homepage,
    title: STRINGS.appRoutes.ffbeEquipRebornHomepage,
    canActivate: [oldHomepageLink],
    data: { header: STRINGS.appRoutes.welcomeKupo, banner: 'MogChocobo' },
  },
  {
    path: 'builder',
    loadComponent: () => import('./features/builder/builder').then((m) => m.Builder),
    title: STRINGS.appRoutes.ffbeEquipRebornBuilder,
    data: { header: STRINGS.appRoutes.builder, banner: 'Lid' },
  },
  {
    path: 'encyclopedia',
    loadComponent: () => import('./features/encyclopedia/encyclopedia').then((m) => m.Encyclopedia),
    title: STRINGS.appRoutes.ffbeEquipRebornItem,
    data: { header: STRINGS.appRoutes.itemEncyclopedia, banner: 'Sakura' },
  },
  {
    path: 'unitSearch',
    loadComponent: () => import('./features/unit-search/unit-search').then((m) => m.UnitSearch),
    title: STRINGS.appRoutes.ffbeEquipRebornUnit,
    data: { header: STRINGS.appRoutes.unitSearch, banner: 'Lasswell' },
  },
  {
    path: 'events',
    loadComponent: () => import('./features/events/events').then((m) => m.Events),
    title: STRINGS.appRoutes.ffbeEquipRebornEvents,
    data: { header: STRINGS.appRoutes.events, banner: 'Sol' },
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory').then((m) => m.InventoryPage),
    title: STRINGS.appRoutes.ffbeEquipRebornInventory,
    data: { header: STRINGS.appRoutes.inventory, banner: 'Jake' },
  },
  {
    path: 'units',
    loadComponent: () => import('./features/units/units').then((m) => m.Units),
    title: STRINGS.appRoutes.ffbeEquipRebornUnits,
    data: { header: STRINGS.appRoutes.units, banner: 'Rain' },
  },
  {
    path: 'espers',
    loadComponent: () => import('./features/espers/espers').then((m) => m.Espers),
    title: STRINGS.appRoutes.ffbeEquipRebornEspers,
    data: { header: STRINGS.appRoutes.espers, banner: 'Nichol' },
  },
  {
    path: 'data-import',
    loadComponent: () => import('./features/data-import/data-import').then((m) => m.DataImport),
    title: STRINGS.appRoutes.ffbeEquipRebornData,
    data: { header: STRINGS.appRoutes.dataImport, banner: 'Charlotte' },
  },
  {
    path: 'contribute',
    loadComponent: () => import('./features/contribute/contribute').then((m) => m.Contribute),
    title: STRINGS.appRoutes.ffbeEquipRebornContribution,
    data: { header: STRINGS.appRoutes.contribute, banner: 'Fina' },
  },
  {
    path: 'algorithm',
    loadComponent: () => import('./features/algorithm/algorithm').then((m) => m.Algorithm),
    title: STRINGS.appRoutes.ffbeEquipRebornAlgorithm,
    data: { theme: 'light' },
  },
  {
    path: 'builderHelp',
    loadComponent: () => import('./features/builder-help/builder-help').then((m) => m.BuilderHelp),
    title: STRINGS.appRoutes.ffbeEquipRebornBuilder2,
    data: { theme: 'light' },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/privacy/privacy').then((m) => m.Privacy),
    title: STRINGS.appRoutes.ffbeEquipRebornPrivacy,
  },
  // Old links (`builder.html#...`, `espers.html?server=JP#...`) keep working: the router keeps the query and the fragment.
  { path: 'homepage.html', redirectTo: '' },
  ...[
    'builder',
    'encyclopedia',
    'unitSearch',
    'inventory',
    'units',
    'espers',
    'data-import',
    'contribute',
    'algorithm',
    'builderHelp',
    'privacy',
  ].map((path) => ({ path: `${path}.html`, redirectTo: path })),
  { path: '**', component: PagePlaceholder, title: STRINGS.appRoutes.pageNotFound },
];
