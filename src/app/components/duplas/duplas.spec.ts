import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Duplas } from './duplas';

describe('Duplas', () => {
  let component: Duplas;
  let fixture: ComponentFixture<Duplas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Duplas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Duplas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
