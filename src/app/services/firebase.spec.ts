import { TestBed } from '@angular/core/testing';

import { ConfiguracaoService } from './configuracao';
import { FirebaseService } from './firebase';

describe('Configuracao', () => {
  let service: FirebaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FirebaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
