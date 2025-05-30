import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="app-container">
      <nav class="navbar">
        <div class="nav-brand">
          <h1>🏖️ Pirâmide Beach Tennis</h1>
        </div>
        <div class="nav-links">
          <a routerLink="/piramide" routerLinkActive="active">Pirâmide</a>
          <a routerLink="/duplas" routerLinkActive="active">Duplas</a>
          <a routerLink="/jogos" routerLinkActive="active">Jogos</a>
        </div>
      </nav>
      
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    
    .navbar {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .nav-brand h1 {
      margin: 0;
      color: #333;
      font-size: 1.5rem;
    }
    
    .nav-links {
      display: flex;
      gap: 2rem;
      align-items: center;
    }
    
    .nav-links a {
      text-decoration: none;
      color: #666;
      font-weight: 500;
      padding: 0.5rem 1rem;
      border-radius: 5px;
      transition: all 0.3s;
    }
    
    .nav-links a:hover,
    .nav-links a.active {
      background: #667eea;
      color: white;
    }
    
    .main-content {
      padding: 2rem;
      min-height: calc(100vh - 80px);
    }
    
    @media (max-width: 768px) {
      .navbar {
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
      }
      
      .nav-links {
        flex-wrap: wrap;
        justify-content: center;
        gap: 1rem;
      }
      
      .nav-brand h1 {
        font-size: 1.2rem;
      }
    }
  `]
})
export class AppComponent {
  title = 'piramide-beach-tennis';
}