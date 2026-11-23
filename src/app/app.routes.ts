import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Homepage } from './features/homepage/homepage';
import { BannerName } from './layout/site-header/site-header';
import { PagePlaceholder } from './layout/page-placeholder/page-placeholder';

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
    title: 'FFBE Equip Reborn - Homepage',
    canActivate: [oldHomepageLink],
    data: { header: 'Welcome, Kupo!', banner: 'MogChocobo' },
  },
  {
    path: 'builder',
    loadComponent: () => import('./features/builder/builder').then((m) => m.Builder),
    title: 'FFBE Equip Reborn - Builder',
    data: { header: 'Builder', banner: 'Lid' },
  },
  {
    path: 'encyclopedia',
    loadComponent: () => import('./features/encyclopedia/encyclopedia').then((m) => m.Encyclopedia),
    title: 'FFBE Equip Reborn - Item Encyclopedia',
    data: { header: 'Item Encyclopedia', banner: 'Sakura' },
  },
  {
    path: 'unitSearch',
    loadComponent: () => import('./features/unit-search/unit-search').then((m) => m.UnitSearch),
    title: 'FFBE Equip Reborn - Unit Search',
    data: { header: 'Unit Search', banner: 'Lasswell' },
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory').then((m) => m.InventoryPage),
    title: 'FFBE Equip Reborn : Inventory',
    data: { header: 'Inventory', banner: 'Jake' },
  },
  {
    path: 'units',
    loadComponent: () => import('./features/units/units').then((m) => m.Units),
    title: 'FFBE Equip Reborn : Units',
    data: { header: 'Units', banner: 'Rain' },
  },
  {
    path: 'espers',
    loadComponent: () => import('./features/espers/espers').then((m) => m.Espers),
    title: 'FFBE Equip Reborn : Espers',
    data: { header: 'Espers', banner: 'Nichol' },
  },
  {
    path: 'data-import',
    loadComponent: () => import('./features/data-import/data-import').then((m) => m.DataImport),
    title: 'FFBE Equip Reborn : Data import',
    data: { header: 'Data import', banner: 'Charlotte' },
  },
  {
    path: 'contribute',
    loadComponent: () => import('./features/contribute/contribute').then((m) => m.Contribute),
    title: 'FFBE Equip Reborn - Contribution',
    data: { header: 'Contribute', banner: 'Fina' },
  },
  {
    path: 'algorithm',
    loadComponent: () => import('./features/algorithm/algorithm').then((m) => m.Algorithm),
    title: 'FFBE Equip Reborn - Algorithm',
    data: { theme: 'light' },
  },
  {
    path: 'builderHelp',
    loadComponent: () => import('./features/builder-help/builder-help').then((m) => m.BuilderHelp),
    title: 'FFBE Equip Reborn : Builder Help',
    data: { theme: 'light' },
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/privacy/privacy').then((m) => m.Privacy),
    title: 'FFBE Equip Reborn - Privacy Policy',
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
  { path: '**', component: PagePlaceholder, title: 'Page not found' },
];
