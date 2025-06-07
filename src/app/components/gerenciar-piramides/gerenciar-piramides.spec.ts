import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GerenciarPiramides } from './gerenciar-piramides';

describe('GerenciarPiramides', () => {
  let component: GerenciarPiramides;
  let fixture: ComponentFixture<GerenciarPiramides>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GerenciarPiramides]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GerenciarPiramides);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
