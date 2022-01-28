{ pkgs ? <nixpkgs>, ...}:
with (import (pkgs + "/pkgs/development/tools/yarn2nix-moretea/yarn2nix/default.nix") { });
{
  force-bridge = mkYarnPackage {
    name = "force-bridge";
    src = ./.;
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
    yarnNix = ./yarn.nix;
  };
}
