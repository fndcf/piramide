import { TestBed } from '@angular/core/testing';

import { DuplasService } from './duplas';

describe('Duplas', () => {
  let service: DuplasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DuplasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
