import { TestBed } from '@angular/core/testing';

import { Configuracao } from './configuracao';

describe('Configuracao', () => {
  let service: Configuracao;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Configuracao);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
