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

  build = mkYarnPackage rec {
    name = "force-bridge-ui-production";
    src = ./apps/ui;
    yarnLock = ./yarn.lock;

    workspaceDependencies = [ force-bridge-package force-bridge.force-bridge-commons ];

    installPhase = ''
      runHook preInstall

      # We need this file
      cp ${tsconfig-build} deps/tsconfig.build.json

      # Our files for this package live here
      cd deps/@force-bridge/ui

      # We need the global prettier rules
      cp ${prettierrc} .prettierrc

      # Relink node_modules to have write access for caching (.cache)
      rm node_modules
      ln -s ../../../node_modules node_modules

      # global eslint file included and relinked
      cp ${workspace-eslintrc} .global-eslintrc.js
      sed -i 's+../../.eslintrc.js+./.global-eslintrc.js+' ./.eslintrc.js

      # Build (without version) TODO version
      yarn build-no-version --offline

      mkdir -p $out
      mv build $out

      runHook postInstall
    '';

    # doDist doesn't work you have to do distPhase = true
    # TODO(skylar): Do we want a distPhase?
    # doDist = false;
    distPhase = ''
    true
    '';
  };
in
{
  # Production build
  inherit build;

  # yarn packages
  packages = force-bridge // { force-bridge = force-bridge-package; };
}
