import { TestBed } from '@angular/core/testing';

import { ConfiguracaoService } from './configuracao';

describe('Configuracao', () => {
  let service: ConfiguracaoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfiguracaoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
