import { TestBed } from '@angular/core/testing';

import { PiramideService } from './piramide';

describe('Piramide', () => {
  let service: PiramideService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PiramideService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
