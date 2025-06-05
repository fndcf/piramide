import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdicionarDuplaComponent } from './adicionar-dupla';

describe('AdicionarDupla', () => {
  let component: AdicionarDuplaComponent;
  let fixture: ComponentFixture<AdicionarDuplaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdicionarDuplaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdicionarDuplaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
