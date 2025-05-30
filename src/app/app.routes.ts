
import { Routes } from '@angular/router';
import { PiramideComponent } from './components/piramide/piramide';
import { DuplasComponent } from './components/duplas/duplas';
import { JogosComponent } from './components/jogos/jogos';
import { LoginComponent } from './components/auth/login/login';
import { RegisterComponent } from './components/auth/register/register';

export const routes: Routes = [
  { path: '', redirectTo: '/piramide', pathMatch: 'full' },
  { path: 'piramide', component: PiramideComponent },
  { path: 'duplas', component: DuplasComponent },
  { path: 'jogos', component: JogosComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: '**', redirectTo: '/piramide' }
];