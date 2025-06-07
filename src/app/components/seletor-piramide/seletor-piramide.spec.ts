import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeletorPiramide } from './seletor-piramide';

describe('SeletorPiramide', () => {
  let component: SeletorPiramide;
  let fixture: ComponentFixture<SeletorPiramide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeletorPiramide]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeletorPiramide);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
