import { TestBed } from '@angular/core/testing';

import { Duplas } from './duplas';

describe('Duplas', () => {
  let service: Duplas;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Duplas);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
