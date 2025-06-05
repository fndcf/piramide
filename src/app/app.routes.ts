
import { Routes } from '@angular/router';
import { PiramideComponent } from './components/piramide/piramide';

export const routes: Routes = [
  { path: '', redirectTo: '/piramide', pathMatch: 'full' },
  { path: 'piramide', component: PiramideComponent },
  { path: '**', redirectTo: '/piramide' }
];