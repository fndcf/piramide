import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdicionarDupla } from './adicionar-dupla';

describe('AdicionarDupla', () => {
  let component: AdicionarDupla;
  let fixture: ComponentFixture<AdicionarDupla>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdicionarDupla]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdicionarDupla);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
