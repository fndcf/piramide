import { TestBed } from '@angular/core/testing';

import { Jogos } from './jogos';

describe('Jogos', () => {
  let service: Jogos;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Jogos);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
