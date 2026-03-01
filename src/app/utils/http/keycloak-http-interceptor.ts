import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { KeycloakService } from '../keycloak/keycloak.service';
import { catchError, from, of, switchMap } from 'rxjs';

export const keycloakHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const keycloakService = inject(KeycloakService);
  const keycloak = keycloakService.keycloak;

  if (!keycloak?.token) {
    keycloak?.login();
    return next(req);
  }

  return from(
    keycloak.updateToken(30)
  ).pipe(
      switchMap(() => {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${keycloak.token}`
          }
        });
        return next(authReq);
      }),
      catchError((error) => {
        console.error('Token refresh failed', error);
        keycloak.login();
        return of();
      })
    );

};
