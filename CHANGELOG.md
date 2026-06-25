# Changelog

## [0.44.14](https://github.com/skenion/skenion-studio/compare/v0.44.13...v0.44.14) (2026-06-25)


### Bug Fixes

* **ci:** derive runtime manifests from dsub downloads ([#181](https://github.com/skenion/skenion-studio/issues/181)) ([ede748b](https://github.com/skenion/skenion-studio/commit/ede748bd851206a20ce54856b36e61d80b7ccb32))

## [0.44.13](https://github.com/skenion/skenion-studio/compare/v0.44.12...v0.44.13) (2026-06-25)


### Bug Fixes

* **ci:** auto publish studio releases ([#179](https://github.com/skenion/skenion-studio/issues/179)) ([eb26507](https://github.com/skenion/skenion-studio/commit/eb26507a4c3009df7dbbde2823da27b5fc69d4c2))

## [0.44.12](https://github.com/skenion/skenion-studio/compare/v0.44.11...v0.44.12) (2026-06-25)


### Bug Fixes

* **ci:** use platform slugs for desktop release jobs ([#177](https://github.com/skenion/skenion-studio/issues/177)) ([0533a3f](https://github.com/skenion/skenion-studio/commit/0533a3f3cb4a7af4a998798bc3e03c8d7552b212))

## [0.44.11](https://github.com/skenion/skenion-studio/compare/v0.44.10...v0.44.11) (2026-06-25)


### Bug Fixes

* **ci:** publish studio installers via dsub ([#174](https://github.com/skenion/skenion-studio/issues/174)) ([3597bf0](https://github.com/skenion/skenion-studio/commit/3597bf05fd70e67b10d6d3aeb3dd627e8c981960))
* **ci:** repair desktop release workflow yaml ([#176](https://github.com/skenion/skenion-studio/issues/176)) ([9261c10](https://github.com/skenion/skenion-studio/commit/9261c104fe20e3c1718cedcd3fecdfedee03a702))

## [0.44.10](https://github.com/skenion/skenion-studio/compare/v0.44.9...v0.44.10) (2026-06-25)


### Bug Fixes

* **ci:** handle windows desktop checksum paths ([#171](https://github.com/skenion/skenion-studio/issues/171)) ([e3c5bfd](https://github.com/skenion/skenion-studio/commit/e3c5bfd9e9e7bc03a0f17b9d640e61cb2663b015))

## [0.44.9](https://github.com/skenion/skenion-studio/compare/v0.44.8...v0.44.9) (2026-06-25)


### Bug Fixes

* **ci:** stage runtime sidecars from dsub s3 ([#169](https://github.com/skenion/skenion-studio/issues/169)) ([0aefe45](https://github.com/skenion/skenion-studio/commit/0aefe4593fc7b8ca31c6a525c669688f34904f82))

## [0.44.8](https://github.com/skenion/skenion-studio/compare/v0.44.7...v0.44.8) (2026-06-25)


### Bug Fixes

* **ci:** stage runtime sidecars from dsub release links ([#167](https://github.com/skenion/skenion-studio/issues/167)) ([8a16321](https://github.com/skenion/skenion-studio/commit/8a163214618ce60c07b0b288d37734aa76de2d6c))

## [0.44.7](https://github.com/skenion/skenion-studio/compare/v0.44.6...v0.44.7) (2026-06-25)


### Bug Fixes

* **ci:** trust studio s3 uploads before cdn propagation ([dd2f571](https://github.com/skenion/skenion-studio/commit/dd2f5717465705fe3e176e5ea1537a56580351d0)), refs [#156](https://github.com/skenion/skenion-studio/issues/156)

## [0.44.6](https://github.com/skenion/skenion-studio/compare/v0.44.5...v0.44.6) (2026-06-25)


### Bug Fixes

* **ci:** widen studio public artifact verification ([4734b72](https://github.com/skenion/skenion-studio/commit/4734b72708eabc2f9429e29f6fa696d7e37a4d3e)), refs [#156](https://github.com/skenion/skenion-studio/issues/156)

## [0.44.5](https://github.com/skenion/skenion-studio/compare/v0.44.4...v0.44.5) (2026-06-25)


### Bug Fixes

* **ci:** retry studio public artifact verification ([52ea0c9](https://github.com/skenion/skenion-studio/commit/52ea0c9c4c067dbf0c62c36263f9e5573dbf13c6))

## [0.44.4](https://github.com/skenion/skenion-studio/compare/v0.44.3...v0.44.4) (2026-06-25)


### Bug Fixes

* **ci:** tolerate missing studio s3 metadata ([3400ef9](https://github.com/skenion/skenion-studio/commit/3400ef9fe9402a0f058124468f0c616173391e36))

## [0.44.3](https://github.com/skenion/skenion-studio/compare/v0.44.2...v0.44.3) (2026-06-25)


### Bug Fixes

* **ci:** validate studio release artifact policy ([5162dd0](https://github.com/skenion/skenion-studio/commit/5162dd0052b5723f2f02e3fc985f9fea2bdc54ba))

## [0.44.2](https://github.com/skenion/skenion-studio/compare/v0.44.1...v0.44.2) (2026-06-24)


### Bug Fixes

* **ci:** use canonical studio release tags ([b549db7](https://github.com/skenion/skenion-studio/commit/b549db7de1af46d160ab63e45ce861aca2a87edc)), closes [#148](https://github.com/skenion/skenion-studio/issues/148)
* mark empty studio releases unpromoted ([#141](https://github.com/skenion/skenion-studio/issues/141)) ([eb1fb4a](https://github.com/skenion/skenion-studio/commit/eb1fb4aeeb3635af3c0b0c6a0e6b060a9fac4ccd))

## [0.44.1](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.44.0...skenion-studio-v0.44.1) (2026-06-23)


### Bug Fixes

* **ci:** keep desktop verifier tag-compatible ([c115d72](https://github.com/skenion/skenion-studio/commit/c115d72a4fabad5138e9ca8ba1da96351764a579)), closes [#136](https://github.com/skenion/skenion-studio/issues/136)
* **ci:** require explicit unsigned desktop preview mode ([a4c1616](https://github.com/skenion/skenion-studio/commit/a4c161613838d592b0f7558105567940b94ad4f4)), closes [#136](https://github.com/skenion/skenion-studio/issues/136)

## [0.44.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.43.0...skenion-studio-v0.44.0) (2026-06-23)


### Features

* **studio:** add skenion brand assets ([#128](https://github.com/skenion/skenion-studio/issues/128)) ([0efdc3f](https://github.com/skenion/skenion-studio/commit/0efdc3f8789ebf6ea3068005daee13e3edf75421))
* **studio:** use contracts line runtime evidence ([#134](https://github.com/skenion/skenion-studio/issues/134)) ([406f3f4](https://github.com/skenion/skenion-studio/commit/406f3f4bcd704208c1ce29ed3871a06c042de130))


### Bug Fixes

* **ci:** emit kebab-case Studio release manifests ([#127](https://github.com/skenion/skenion-studio/issues/127)) ([54b8e7d](https://github.com/skenion/skenion-studio/commit/54b8e7df1e4c76cc42cf241a5620341b118dce5b))

## [0.43.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.31.0...skenion-studio-v0.43.0) (2026-06-22)


### Features

* **studio:** package desktop runtime sidecars ([ce8df02](https://github.com/skenion/skenion-studio/commit/ce8df02056d29f809785543b155bc5c720e7fcc9)), closes [#86](https://github.com/skenion/skenion-studio/issues/86)


### Bug Fixes

* **ci:** dispatch release please by train ([89ec3a2](https://github.com/skenion/skenion-studio/commit/89ec3a2292a6fea88b7e1dbe531d56b383596bbd))
* **runtime:** use explicit default session path ([#100](https://github.com/skenion/skenion-studio/issues/100)) ([405afe1](https://github.com/skenion/skenion-studio/commit/405afe174a557372096556c235c17084964b803d))
* **studio:** align contracts dependency with 0.43 train ([7caeb15](https://github.com/skenion/skenion-studio/commit/7caeb15726cc24e0653790646a8bcb2815af4b16))

## [0.31.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.30.0...skenion-studio-v0.31.0) (2026-06-21)


### Features

* switch studio active graph to v0.2 ([#94](https://github.com/skenion/skenion-studio/issues/94)) ([a348cb4](https://github.com/skenion/skenion-studio/commit/a348cb4890fbba1d757d159ac6120f7e9ae18210))

## [0.30.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.29.0...skenion-studio-v0.30.0) (2026-06-21)


### Features

* **studio:** add Tauri shell and runtime session profiles ([#91](https://github.com/skenion/skenion-studio/issues/91)) ([67c2951](https://github.com/skenion/skenion-studio/commit/67c2951fcac3088318f03148ab1782559a901b63))

## [0.29.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.28.0...skenion-studio-v0.29.0) (2026-06-21)


### Features

* **graph:** implement fragment clipboard help working copies ([#89](https://github.com/skenion/skenion-studio/issues/89)) ([53c106f](https://github.com/skenion/skenion-studio/commit/53c106f475c695c35626ba4fafb0625b4d090430))

## [0.28.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.27.0...skenion-studio-v0.28.0) (2026-06-21)


### Features

* **graph:** add v0.2 patch library foundation ([#82](https://github.com/skenion/skenion-studio/issues/82)) ([dc4476d](https://github.com/skenion/skenion-studio/commit/dc4476dc8ca145569388db9b9d0d54aa5ccfe99f)), closes [#81](https://github.com/skenion/skenion-studio/issues/81)

## [0.27.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.26.3...skenion-studio-v0.27.0) (2026-06-19)


### Features

* **studio:** add object box authoring v0 ([ae29e85](https://github.com/skenion/skenion-studio/commit/ae29e85441a334acd194838108581f3cc182679e))

## [0.26.3](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.26.2...skenion-studio-v0.26.3) (2026-06-19)


### Bug Fixes

* **studio:** ignore dependency symlinks in vite watch ([#73](https://github.com/skenion/skenion-studio/issues/73)) ([3a5d084](https://github.com/skenion/skenion-studio/commit/3a5d08497c461dbc3494f95ab4260aa7d24686ee))

## [0.26.2](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.26.1...skenion-studio-v0.26.2) (2026-06-19)


### Bug Fixes

* **studio:** expect comment control inlet ([#71](https://github.com/skenion/skenion-studio/issues/71)) ([5535f76](https://github.com/skenion/skenion-studio/commit/5535f760900835e1197ab9f481514f7eea3eda7d))

## [0.26.1](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.26.0...skenion-studio-v0.26.1) (2026-06-19)


### Bug Fixes

* **studio:** stabilize control interactions ([#69](https://github.com/skenion/skenion-studio/issues/69)) ([1256be3](https://github.com/skenion/skenion-studio/commit/1256be3e41ce2846fca2d25e8c98773347b63e74))

## [0.26.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.25.1...skenion-studio-v0.26.0) (2026-06-19)


### Features

* **studio:** align object controls with pd-style inlets ([#66](https://github.com/skenion/skenion-studio/issues/66)) ([3e71fc8](https://github.com/skenion/skenion-studio/commit/3e71fc8830b333bd56688e600fbb26f61211bbc3))

## [0.25.1](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.25.0...skenion-studio-v0.25.1) (2026-06-19)


### Bug Fixes

* **studio:** keep selected cables thin ([43be90e](https://github.com/skenion/skenion-studio/commit/43be90e4ca78c289c794b36cbe3ba43b8eae041a))
* **studio:** lock graph layout editing ([4492e87](https://github.com/skenion/skenion-studio/commit/4492e87121cc868ed98c179bbcd4e96cf9a2d999))
* **studio:** stabilize live control object updates ([7f16b2d](https://github.com/skenion/skenion-studio/commit/7f16b2d9eb9188a8a8884cce7d1f61d7e084d0a3))

## [0.25.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.24.0...skenion-studio-v0.25.0) (2026-06-19)


### Features

* **studio:** require runtime-owned graph sessions ([c925a64](https://github.com/skenion/skenion-studio/commit/c925a644ed2cb7ffdd96a028523a2dbbbad02109))

## [0.24.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.23.0...skenion-studio-v0.24.0) (2026-06-19)


### Features

* **studio:** expose semantic representation controls ([a018d2b](https://github.com/skenion/skenion-studio/commit/a018d2b5b7c16c63be9757e02b943800a284ee10))

## [0.23.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.22.0...skenion-studio-v0.23.0) (2026-06-18)


### Features

* **studio:** send runtime control messages ([66d7949](https://github.com/skenion/skenion-studio/commit/66d7949c1399c055cab9dd2f17d4c15ff8928c97))


### Bug Fixes

* **studio:** use localhost runtime defaults ([8cf295c](https://github.com/skenion/skenion-studio/commit/8cf295cf4659dd7a659a59ed52374134c7a4d28c))

## [0.22.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.21.0...skenion-studio-v0.22.0) (2026-06-18)


### Features

* **studio:** add max-style object controls ([#53](https://github.com/skenion/skenion-studio/issues/53)) ([84cfd0c](https://github.com/skenion/skenion-studio/commit/84cfd0cb234b1d6bea2aed81c36f66a9d1b1c92c))

## [0.21.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.20.0...skenion-studio-v0.21.0) (2026-06-17)


### Features

* **studio:** save project view state ([0eea041](https://github.com/skenion/skenion-studio/commit/0eea041da6e8cc7b9b272e90c62c79c5fc607b7f))
* **studio:** save project view state ([18fe51e](https://github.com/skenion/skenion-studio/commit/18fe51e0478eb975e14d81663977558b101493db))

## [0.20.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.19.0...skenion-studio-v0.20.0) (2026-06-17)


### Features

* **studio:** surface live preview control state ([#48](https://github.com/skenion/skenion-studio/issues/48)) ([b24ad3b](https://github.com/skenion/skenion-studio/commit/b24ad3b2e85f361733ea5249531c2151023005d1))

## [0.19.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.18.0...skenion-studio-v0.19.0) (2026-06-17)


### Features

* **studio:** add send receive panel controls ([be81cdf](https://github.com/skenion/skenion-studio/commit/be81cdfe080a6cd2b88bd1eaa2b5b614909f4b2c))

## [0.18.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.17.0...skenion-studio-v0.18.0) (2026-06-17)


### Features

* **studio:** add node help graph viewer ([a6e0574](https://github.com/skenion/skenion-studio/commit/a6e0574bcd56ae513d58e66cf55e926c582964b4))

## [0.17.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.16.0...skenion-studio-v0.17.0) (2026-06-17)


### Features

* **studio:** add shader diagnostics ux ([#42](https://github.com/skenion/skenion-studio/issues/42)) ([8735681](https://github.com/skenion/skenion-studio/commit/8735681bc355381027309dea05c4fe1154ab2de5))

## [0.16.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.15.0...skenion-studio-v0.16.0) (2026-06-17)


### Features

* **studio:** add control layer inspector help ([2cbe723](https://github.com/skenion/skenion-studio/commit/2cbe723b4dc108da893e9361c0939fba948cb5e0))
* **studio:** sync fullscreen shader inputs ([#41](https://github.com/skenion/skenion-studio/issues/41)) ([003cd45](https://github.com/skenion/skenion-studio/commit/003cd45da16e1b20d2028b2af15cea9689447f67))

## [0.15.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.14.0...skenion-studio-v0.15.0) (2026-06-17)


### Features

* **studio:** add typed value runtime controls ([#37](https://github.com/skenion/skenion-studio/issues/37)) ([91e330c](https://github.com/skenion/skenion-studio/commit/91e330cc1255adb0baf8d25a19462d3b1b0d6fa0))

## [0.14.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.13.2...skenion-studio-v0.14.0) (2026-06-17)


### Features

* **studio:** add multi uniform shader sample ([#35](https://github.com/skenion/skenion-studio/issues/35)) ([2476e38](https://github.com/skenion/skenion-studio/commit/2476e38958274285aca5de77838ea2c151c043ac))

## [0.13.2](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.13.1...skenion-studio-v0.13.2) (2026-06-17)


### Bug Fixes

* **studio:** enforce strict visual gate artifacts ([0afb02b](https://github.com/skenion/skenion-studio/commit/0afb02b766bcb1c5bc40fdda3408c74a31c5d45f))

## [0.13.1](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.13.0...skenion-studio-v0.13.1) (2026-06-16)


### Bug Fixes

* **studio:** harden node port and edge interaction UX ([3632dba](https://github.com/skenion/skenion-studio/commit/3632dbacd038608242fe1bf77445f895bec63081))

## [0.13.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.12.0...skenion-studio-v0.13.0) (2026-06-16)


### Features

* **studio:** add shader uniform controls ([0589e51](https://github.com/skenion/skenion-studio/commit/0589e51642553316d343d34d31fb748a8cd9ba5e))

## [0.12.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.11.0...skenion-studio-v0.12.0) (2026-06-16)


### Features

* **studio:** add storybook component architecture ([981659b](https://github.com/skenion/skenion-studio/commit/981659b12a765ef1228981701c39525642daa415))

## [0.11.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.10.0...skenion-studio-v0.11.0) (2026-06-16)


### Features

* **studio:** add port edge feedback diagnostics ([f541419](https://github.com/skenion/skenion-studio/commit/f5414192298e49a02b2db4e64831b39e57bcaeaf))
* **studio:** expose port handles and render output sample ([60589d9](https://github.com/skenion/skenion-studio/commit/60589d9848768296d456de40198c39e8bca75472))

## [0.10.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.9.0...skenion-studio-v0.10.0) (2026-06-16)


### Features

* **studio:** add fullscreen shader node editor ([#19](https://github.com/skenion/skenion-studio/issues/19)) ([6637c7c](https://github.com/skenion/skenion-studio/commit/6637c7ceb74d481c14cde664484df31bb357751c))

## [0.9.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.8.0...skenion-studio-v0.9.0) (2026-06-16)


### Features

* **studio:** show runtime telemetry ([#17](https://github.com/skenion/skenion-studio/issues/17)) ([bc16e5a](https://github.com/skenion/skenion-studio/commit/bc16e5ae3acbb77f9e14027a9cc8295d3802c0ce))

## [0.8.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.7.0...skenion-studio-v0.8.0) (2026-06-16)


### Features

* **studio:** add clear color render node controls ([#15](https://github.com/skenion/skenion-studio/issues/15)) ([79f9a44](https://github.com/skenion/skenion-studio/commit/79f9a444fe2861a9fb0944abe0e1158f230fc6ed))

## [0.7.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.6.0...skenion-studio-v0.7.0) (2026-06-16)


### Features

* **studio:** control local runtime preview ([0eeb1f8](https://github.com/skenion/skenion-studio/commit/0eeb1f8ec5217fa71655933ceb64cb3717933903))

## [0.6.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.5.0...skenion-studio-v0.6.0) (2026-06-16)


### Features

* **studio:** add runtime patch history controls ([e73846f](https://github.com/skenion/skenion-studio/commit/e73846f9c569a4a8107fe14420d6118da096d9ba))

## [0.5.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.4.0...skenion-studio-v0.5.0) (2026-06-16)


### Features

* **studio:** sync runtime sessions with graph patches ([4118b6f](https://github.com/skenion/skenion-studio/commit/4118b6f8340abb586afe86f1bae264280d67b00b))

## [0.4.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.3.0...skenion-studio-v0.4.0) (2026-06-15)


### Features

* **studio:** load graphs into runtime sessions ([36ae337](https://github.com/skenion/skenion-studio/commit/36ae337c2e3c3a44f0cbf0c3b6b290f4087794c8))

## [0.3.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.2.0...skenion-studio-v0.3.0) (2026-06-15)


### Features

* **studio:** connect to local runtime ([5f743cf](https://github.com/skenion/skenion-studio/commit/5f743cf1797ebbdb5b268b22f4cf1005a7d6479f))

## [0.2.0](https://github.com/skenion/skenion-studio/compare/skenion-studio-v0.1.0...skenion-studio-v0.2.0) (2026-06-15)


### Features

* **studio:** scaffold graph editor shell ([#1](https://github.com/skenion/skenion-studio/issues/1)) ([6a04483](https://github.com/skenion/skenion-studio/commit/6a0448336abe17dc5fd7f3880f45f0a2e64d898f))
