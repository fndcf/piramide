import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfiguracaoModal } from './configuracao-modal';

describe('ConfiguracaoModal', () => {
  let component: ConfiguracaoModal;
  let fixture: ComponentFixture<ConfiguracaoModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguracaoModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfiguracaoModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
