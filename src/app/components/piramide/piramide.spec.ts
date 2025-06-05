import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PiramideComponent } from './piramide';

describe('Piramide', () => {
  let component: PiramideComponent;
  let fixture: ComponentFixture<PiramideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PiramideComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PiramideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
