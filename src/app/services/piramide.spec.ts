import { TestBed } from '@angular/core/testing';

import { PiramidesService } from './piramides';

describe('Piramide', () => {
  let service: PiramidesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PiramidesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
