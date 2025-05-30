import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalGerenciarDupla } from './modal-gerenciar-dupla';

describe('ModalGerenciarDupla', () => {
  let component: ModalGerenciarDupla;
  let fixture: ComponentFixture<ModalGerenciarDupla>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalGerenciarDupla]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalGerenciarDupla);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
