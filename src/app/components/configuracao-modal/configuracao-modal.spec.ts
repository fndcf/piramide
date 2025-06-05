import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfiguracaoModalComponent } from './configuracao-modal';

describe('ConfiguracaoModal', () => {
  let component: ConfiguracaoModalComponent;
  let fixture: ComponentFixture<ConfiguracaoModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguracaoModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfiguracaoModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
