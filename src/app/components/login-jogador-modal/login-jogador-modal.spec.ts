import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginJogadorModal } from './login-jogador-modal';

describe('LoginJogadorModal', () => {
  let component: LoginJogadorModal;
  let fixture: ComponentFixture<LoginJogadorModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginJogadorModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginJogadorModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
