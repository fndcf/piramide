import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginJogadorModalComponent } from './login-jogador-modal';

describe('LoginJogadorModal', () => {
  let component: LoginJogadorModalComponent;
  let fixture: ComponentFixture<LoginJogadorModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginJogadorModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginJogadorModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
