import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Piramide } from './piramide';

describe('Piramide', () => {
  let component: Piramide;
  let fixture: ComponentFixture<Piramide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Piramide]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Piramide);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
