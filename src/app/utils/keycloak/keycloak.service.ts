import { Injectable } from '@angular/core';
import Keycloak from "keycloak-js";
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class KeycloakService {
  private _keycloak: Keycloak | undefined;

  constructor(){}

  get keycloak() {
    if (!this._keycloak){
      this._keycloak = new Keycloak({
        url: environment.keycloakUrl,
        realm: "whatsapp-clone",
        clientId: "whatsapp-clone-app"
      });
    }
    return this._keycloak;
  }

  async init() {
    const authenticated = await this.keycloak.init({
      onLoad: "login-required"
    });
    // if (authenticated) {
    //   const profile = await this.keycloak.loadUserProfile();
    //   console.log("Authenticated");
    //   console.log(this.keycloak.token);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.tokenParsed);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.idToken);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.idTokenParsed);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.refreshToken);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.refreshTokenParsed);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.realm);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.realmAccess);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.resourceAccess);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.loginRequired);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.userInfo);
    //   console.log("-----------------------------------");
    //   console.log(this.keycloak.profile);
    //   console.log("-----------------------------------");
    //   console.log("Profile:", profile);
    // }
  }

  login() {
    this.keycloak.login();
  }

  get userId(): string {
    return this.keycloak.tokenParsed?.sub as string;
  }

  get isTok1enValid(): boolean {
    return !this.keycloak.isTokenExpired();
  }

  get fullName(): string {
    return this.keycloak.tokenParsed?.["name"] as string;
  }

  logout() {
    return this.keycloak.logout({redirectUri: environment.baseUrl});
  }

  accountMangement() {
    return this.keycloak.accountManagement();
  }

}
