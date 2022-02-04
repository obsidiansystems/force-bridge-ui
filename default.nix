{ pkgs-path ? <nixpkgs>, ...}:
with (import (pkgs-path + "/pkgs/development/tools/yarn2nix-moretea/yarn2nix/default.nix") { });
let
  pkgs = import pkgs-path {};

  force-bridge = mkYarnWorkspace {
    name = "force-bridge";
    src = ./.;
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
    yarnNix = ./yarn.nix;
  };

  force-bridge-package = mkYarnPackage {
    name = "force-bridge-depends";
    src = ./.;
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
    yarnNix = ./yarn.nix;
  };

  workspace-eslintrc =
    let
      text = builtins.readFile (./. + "/.eslintrc.js");
    in
    pkgs.writeText ".eslintrc.js" text;

  tsconfig-build =
    let
      text = builtins.toJSON (builtins.fromJSON (builtins.readFile (./. + "/tsconfig.build.json")));
    in
    pkgs.writeText "tsconfig.build.json" text;

  prettierrc =
    let
      text = builtins.readFile (./. + "/.prettierrc");
    in
      pkgs.writeText ".prettierrc" text;

  global-package =
    let
      text = builtins.readFile (./. + "/package.json");
    in
      pkgs.writeText "package.json" text;

  build = mkYarnPackage rec {
    name = "force-bridge-ui-production";
    src = ./.;
    yarnLock = ./yarn.lock;

    workspaceDependencies = [ force-bridge-package force-bridge.force-bridge-commons force-bridge.force-bridge-ui ];

    installPhase = ''
      runHook preInstall

      rm .yarnrc

      ls -l deps/

      cp -r ${src}/* .
      chmod -R +w .

      yarn build:lib

      cp -r packages/commons/lib deps/@force-bridge/commons/

      cd apps/ui
      cp ${prettierrc} .prettierrc
      cp ${workspace-eslintrc} .global-eslintrc.js
      sed -i 's+../../.eslintrc.js+./.global-eslintrc.js+' ./.eslintrc.js
      yarn build-no-version --offline

      mkdir -p $out
      mv build $out

      runHook postInstall
    '';

    distPhase = ''true'';
  };
in
{
  # Production build
  inherit build;

  # yarn packages
  packages = force-bridge // { force-bridge = force-bridge-package; };
}
