import { TestBed } from '@angular/core/testing';

import { Piramide } from './piramide';

describe('Piramide', () => {
  let service: Piramide;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Piramide);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
