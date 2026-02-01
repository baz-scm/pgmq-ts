# Changelog

## [0.3.7](https://github.com/baz-scm/pgmq-ts/compare/v0.3.6...v0.3.7) (2026-02-01)


### 🐛 Bug Fixes

* Force release ([#52](https://github.com/baz-scm/pgmq-ts/issues/52)) ([3a66ad1](https://github.com/baz-scm/pgmq-ts/commit/3a66ad18ba7539b96f1a0825f6462efdf5f532de))

## [0.3.6](https://github.com/baz-scm/pgmq-ts/compare/v0.3.5...v0.3.6) (2026-02-01)


### ✨ New Features

* Support group FIFO ([#49](https://github.com/baz-scm/pgmq-ts/issues/49)) ([e457a75](https://github.com/baz-scm/pgmq-ts/commit/e457a754817fbabc661c000e73fd804ef427ba3a))

## [0.3.5](https://github.com/baz-scm/pgmq-ts/compare/v0.3.4...v0.3.5) (2025-11-06)


### ✨ New Features

* export Queue class for type referencing ([#46](https://github.com/baz-scm/pgmq-ts/issues/46)) ([9aae68f](https://github.com/baz-scm/pgmq-ts/commit/9aae68f5a2dfd579687bd02c1f8ce301ffcb5648))

## [0.3.4](https://github.com/baz-scm/pgmq-ts/compare/v0.3.3...v0.3.4) (2025-07-30)


### 🐛 Bug Fixes

* bump vulns ([#42](https://github.com/baz-scm/pgmq-ts/issues/42)) ([1ca67da](https://github.com/baz-scm/pgmq-ts/commit/1ca67da720354b239b2d9a69e8c6c5e4c99d2506))

## [0.3.3](https://github.com/baz-scm/pgmq-ts/compare/v0.3.2...v0.3.3) (2025-06-23)


### 🐛 Bug Fixes

* brace expansion vuln ([#40](https://github.com/baz-scm/pgmq-ts/issues/40)) ([ccb3ae4](https://github.com/baz-scm/pgmq-ts/commit/ccb3ae49671d19dc4a71a6aeb3dd8fa1288de6d4))

## [0.3.2](https://github.com/baz-scm/pgmq-ts/compare/v0.3.1...v0.3.2) (2025-03-16)


### 🐛 Bug Fixes

* Update utils.ts lint ([#37](https://github.com/baz-scm/pgmq-ts/issues/37)) ([89ac660](https://github.com/baz-scm/pgmq-ts/commit/89ac6605bc1170a006f1c3c9ceb2550cdea802c5))

## [0.3.1](https://github.com/baz-scm/pgmq-ts/compare/v0.3.0...v0.3.1) (2025-03-11)


### 🐛 Bug Fixes

* prevent duplicate message reads with transaction handling ([#35](https://github.com/baz-scm/pgmq-ts/issues/35)) ([c2b2cd5](https://github.com/baz-scm/pgmq-ts/commit/c2b2cd54bc9b967f82656d2fdc71a695a38fdc3f))

## [0.3.0](https://github.com/baz-scm/pgmq-ts/compare/v0.2.11...v0.3.0) (2025-03-03)


### ⚠ BREAKING CHANGES

* duplicate reads for multiple replicas ([#33](https://github.com/baz-scm/pgmq-ts/issues/33))

### 🐛 Bug Fixes

* duplicate reads for multiple replicas ([#33](https://github.com/baz-scm/pgmq-ts/issues/33)) ([900de6a](https://github.com/baz-scm/pgmq-ts/commit/900de6a56e6bf81d4507a485b2be2e6850dc7e4c))

## [0.2.11](https://github.com/baz-scm/pgmq-ts/compare/v0.2.10...v0.2.11) (2025-02-25)


### 🐛 Bug Fixes

* bump to fix vulns ([#31](https://github.com/baz-scm/pgmq-ts/issues/31)) ([a1062bb](https://github.com/baz-scm/pgmq-ts/commit/a1062bbfaf0f8782cc945402154b60b1e0030e69))

## [0.2.10](https://github.com/baz-scm/pgmq-ts/compare/v0.2.9...v0.2.10) (2024-12-25)


### 🐛 Bug Fixes

* Improve test names ([#27](https://github.com/baz-scm/pgmq-ts/issues/27)) ([922631c](https://github.com/baz-scm/pgmq-ts/commit/922631c644c8de4dd8a4540014d565339bb6ee8f))

## [0.2.9](https://github.com/baz-scm/pgmq-ts/compare/v0.2.8...v0.2.9) (2024-10-22)


### ✨ New Features

* return nullable messages from readMessage if message doesn't exist ([#25](https://github.com/baz-scm/pgmq-ts/issues/25)) ([1d6d383](https://github.com/baz-scm/pgmq-ts/commit/1d6d3830ed8a9f92b6b6a7031b4cb88d4edc9b06))

## [0.2.8](https://github.com/baz-scm/pgmq-ts/compare/v0.2.7...v0.2.8) (2024-10-22)


### ✨ New Features

* Close connection pool gracefully ([#23](https://github.com/baz-scm/pgmq-ts/issues/23)) ([ae9a6bb](https://github.com/baz-scm/pgmq-ts/commit/ae9a6bb4f5f1f12e0324fa8b4ce60922abc3a673))

## [0.2.7](https://github.com/baz-scm/pgmq-ts/compare/v0.2.6...v0.2.7) (2024-10-20)


### 🐛 Bug Fixes

* connection release on mesage read ([#19](https://github.com/baz-scm/pgmq-ts/issues/19)) ([a1c1e81](https://github.com/baz-scm/pgmq-ts/commit/a1c1e811f93bdc80fa61200febf2882a2403d842))

## [0.2.6](https://github.com/baz-scm/pgmq-ts/compare/v0.2.5...v0.2.6) (2024-10-11)


### 🐛 Bug Fixes

* Leverage GH app token instead of user PAT ([30334bd](https://github.com/baz-scm/pgmq-ts/commit/30334bd613be54c5524d0ba8671a838e67bd5e5f))
* Move all SQL to queries.ts ([876cfe4](https://github.com/baz-scm/pgmq-ts/commit/876cfe4bbbb0fc9a20b0cde0495c16bdaa97ebfa))

## [0.2.5](https://github.com/baz-scm/pgmq-ts/compare/v0.2.4...v0.2.5) (2024-10-11)


### 🐛 Bug Fixes

* don't drop comments ([01eb495](https://github.com/baz-scm/pgmq-ts/commit/01eb495cdec07973c751c1cab6cb7987537ef802))
* main and types path ([709cddf](https://github.com/baz-scm/pgmq-ts/commit/709cddf5add7f84d92f397b947aa1e53e8fb67a5))

## [0.2.4](https://github.com/baz-scm/pgmq-ts/compare/v0.2.3...v0.2.4) (2024-10-11)


### 🐛 Bug Fixes

* package dist dir ([62eaba6](https://github.com/baz-scm/pgmq-ts/commit/62eaba6ba38e3286db0658af5d2b9ae5a7d09b8c))

## [0.2.3](https://github.com/baz-scm/pgmq-ts/compare/v0.2.2...v0.2.3) (2024-10-11)


### 🐛 Bug Fixes

* publish compiled module ([73e8fce](https://github.com/baz-scm/pgmq-ts/commit/73e8fcee1cf79d30c54bed1b8ede7fec7443b5a1))

## [0.2.2](https://github.com/baz-scm/pgmq-ts/compare/v0.2.1...v0.2.2) (2024-10-11)


### 🐛 Bug Fixes

* set repository url ([#13](https://github.com/baz-scm/pgmq-ts/issues/13)) ([f040338](https://github.com/baz-scm/pgmq-ts/commit/f040338b96f8d6693e4da499531df08b60fb94ba))

## [0.2.1](https://github.com/baz-scm/pgmq-ts/compare/v0.2.0...v0.2.1) (2024-10-11)


### 🐛 Bug Fixes

* fix .npmignore ([#10](https://github.com/baz-scm/pgmq-ts/issues/10)) ([527c5e3](https://github.com/baz-scm/pgmq-ts/commit/527c5e3ab876eaad0f9c47ad4e53db4f75e334b0))
* rename types ([#11](https://github.com/baz-scm/pgmq-ts/issues/11)) ([40abef3](https://github.com/baz-scm/pgmq-ts/commit/40abef341aae75800b4114efa724d8d977cba955))

## [0.2.0](https://github.com/baz-scm/pgmq-ts/compare/v0.1.2...v0.2.0) (2024-10-11)


### ⚠ BREAKING CHANGES

* Add types ([#8](https://github.com/baz-scm/pgmq-ts/issues/8))

### 🐛 Bug Fixes

* release.yml pnpm install ([#7](https://github.com/baz-scm/pgmq-ts/issues/7)) ([25fee68](https://github.com/baz-scm/pgmq-ts/commit/25fee68274ef75148c1312813fdb5c0ec1dfb817))


### ✨ New Features

* Add types ([#8](https://github.com/baz-scm/pgmq-ts/issues/8)) ([2acd0af](https://github.com/baz-scm/pgmq-ts/commit/2acd0afecbfd0c37dadfb398fe4ca42db679304a))

## [0.1.2](https://github.com/baz-scm/pgmq-ts/compare/v0.1.1...v0.1.2) (2024-10-11)


### ✨ New Features

* Add Queue struct and expose functionality ([#5](https://github.com/baz-scm/pgmq-ts/issues/5)) ([6000ff0](https://github.com/baz-scm/pgmq-ts/commit/6000ff0cf4e6e66bd85ba3d0c75f5062dcdf2c94))

## [0.1.1](https://github.com/baz-scm/pgmq-ts/compare/v0.1.0...v0.1.1) (2024-10-10)


### ✨ New Features

* Add queue name validation ([#3](https://github.com/baz-scm/pgmq-ts/issues/3)) ([5421c96](https://github.com/baz-scm/pgmq-ts/commit/5421c961f9773ffcaa34beb89032c04d2073b7ce))
