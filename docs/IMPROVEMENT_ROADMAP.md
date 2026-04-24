# oxlint-plugin-fsd 개선 로드맵

작성일: 2026-04-24
대상 버전: v0.1.1 → v1.0

---

## 0. 진단 (FSD 린트 생태계 비교 기반 페인포인트)

| # | 페인포인트 | 근거 |
|---|---|---|
| P1 | 룰 커버리지가 import 경계에만 편중 | Steiger 20+ 룰 중 구조·네이밍 룰 0개 보유 |
| P2 | 룰 파일 간 로직 중복 (public-api / `@x` / shared 분기) | `no-public-api-sidestep.ts`, `no-cross-slice-dependency.ts` 패턴 반복 |
| P3 | 테스트 그물 얇음 (rule당 12–109줄) | util 단위 테스트 부재, 옵션 조합·엣지 미커버 |
| P4 | 잠재 버그 | `folderPattern` 활성 시 `layerIndex=-1`, `isSharedPublicApiPath`가 `ui·lib` 하드코딩 (FSD는 임의 segment 허용) |
| P5 | Per-file 캐시 없음 | `extractSliceFromPath`가 파일 1개당 import N회 호출되지만 결과 메모이즈 안 됨 |
| P6 | FS 레벨 룰 실행 경로 없음 | oxlint는 AST per-file 중심. `insignificant-slice` 같은 프로젝트 전역 룰 구현 공간 없음 |

---

## 1. Phase 1 — Foundation Hardening (1주, High ROI)

**목표**: 신규 룰 추가 전 토대 정비.

### 1-a. Rule skeleton factory

```ts
createImportRule({ mergeConfig, checkImport }) → Rule
```

- 7개 룰 공통 스캐폴드(config merge, `testFileRegexes`, `ImportDeclaration`/`ImportExpression` 바인딩, Program 재로드) 1곳으로 흡수
- 룰 파일 평균 60~80줄 감소, 신규 룰 추가 비용 ↓

### 1-b. Per-file path parts 메모이즈

```ts
WeakMap<ForbiddenImportsConfig, LRU<filePath, PathParts>>
```

- `extractLayer/Slice/SegmentFromPath` 결과를 filePath 단위 캐시 (기본 size 2000, FIFO)
- 큰 프로젝트에서 import 100개 파일 기준 파싱 호출 ~100× → 1×

### 1-c. 잠재 버그 수정

- `folderPattern` 활성 시 `findLayerIndex`가 원본 디렉토리명(`01_features`)도 매칭하도록 수정
- `isSharedPublicApiPath`에서 `["ui","lib"]` 하드코딩 → `config.sharedPublicApiSegments: string[] | '*'` 옵션화 (기본 `*`)
- 별칭 `value`가 `/`로 끝나는 경우 `@//` 이중 슬래시 생성 이슈 normalize

### 1-d. Util 단위 테스트 + property-based 테스트

- `fast-check`로 `normalizePath` / `parseFilePathParts` / `stripAliasSegments` 불변식 검증
- Windows CRLF·백슬래시·연속 슬래시 정규화 케이스 추가

---

## 2. Phase 2 — Rule Coverage Expansion (2–3주, Steiger 추격)

**설계 원칙**: AST per-file 룰은 플러그인, FS 전역 룰은 **companion CLI `fsd-doctor`**로 분리.

### 2-a. AST 레벨 신규 룰 (플러그인 본체)

| 룰 | 설명 |
|---|---|
| `no-reserved-folder-names` | 슬라이스명이 segment 예약어(`ui`, `model`, `api`, `lib`, `config`)와 충돌 금지 |
| `no-direct-slice-aliasing` | `import * as X` 형태의 와일드카드 public API 우회 방지 |
| `restrict-shared-segments` | `shared/` 하위 자유 폴더 생성 억제 (화이트리스트 기반) |

### 2-b. FS 레벨 룰 (`fsd-doctor` CLI)

| 룰 | 설명 |
|---|---|
| `ambiguous-slice-names` | `auth-form` ↔ `authForm` 유사 슬라이스명 검출 (Levenshtein ≤ 2) |
| `repetitive-naming` | `features/user/user-card.tsx` 같은 접두 중복 |
| `insignificant-slice` | public export 1개만 있는 슬라이스 (병합 권고) |
| `public-api-required` | 슬라이스 루트에 `index.ts` 존재 강제 |
| `no-segmentless-slices` | 세그먼트 폴더(`ui/`, `model/`, `api/`, `lib/`) 없이 파일 바로 배치 금지 |
| `no-processes` | 레거시 `processes/` 레이어 경고 |

**CLI 아키텍처**:

- `src/cli/doctor.ts` + `src/analyzers/project-index.ts`
- `readdirSync` 1회 + glob으로 프로젝트 트리 인덱싱 → 룰 함수에 전달
- 출력 포맷: oxlint와 호환되는 `--format json` 옵션, `stylish`/`github` reporter

---

## 3. Phase 3 — DX & Error Quality (1주)

### 3-a. 메시지 품질

- diagnostic에 `help` + 예시 + 공식 FSD docs URL
- `suggest` 블록 추가: public API 우회 탐지 시 올바른 import 경로 2~3개 제안

  ```
  @/features/auth/internal → @/features/auth        (index.ts)
                          → @/features/auth/@x/pages (cross-import)
  ```

### 3-b. Auto-fix 확대

- `no-relative-imports`에 alias 복원 fixer (현재 report만)
- `no-public-api-sidestep`에 public API 경로 치환 fixer (가능한 경우)

### 3-c. 구성 UX

- `defineConfig({ layers: [...] })` 타입 안전 헬퍼
- `npx fsd-doctor init` — tsconfig paths 자동 감지해 권장 설정 생성

### 3-d. 마이그레이션 가이드

- `docs/migration-from-conarti.md`
- `docs/migration-from-eslint-plugin-boundaries.md`

---

## 4. Phase 4 — Performance & Observability (1주, 심화)

### 4-a. 벤치 CI 게이트

- baseline 아티팩트(main 브랜치)와 PR 비교, 20% 이상 리그레션 시 fail
- 10k-file 합성 프로젝트 fixture 추가 (현실적 FSD 프로젝트 모사)

### 4-b. 심화 최적화 (측정 후 결정)

- 자주 쓰는 segment 문자열 intern (`Map<string, string>`)
- 단일 파일 내 다중 import 가시성 분석을 한 번에 묶음(batch)

### 4-c. 관측

- 룰별 실행 시간 로깅 옵션 `FSD_PROFILE=1`
- `--timing` 리포터

---

## 추천 실행 순서 & 기대 효과

| 우선순위 | 항목 | 기대 효과 |
|---|---|---|
| 🔴 1 | Phase 1 전체 (skeleton + per-file cache + bug fix + util tests) | 코드베이스 정돈 + 성능 실질 향상 + 회귀 방지 |
| 🟡 2 | Phase 2-a (AST 3룰) | Steiger 대비 기능 격차 축소, 플러그인 범위 내 |
| 🟡 3 | Phase 3-a (메시지 품질) | 사용자 체감 품질 최대 |
| 🟢 4 | Phase 2-b (doctor CLI) | 구조적 룰 = 경쟁 우위, 단 설계 비용 큼 |
| 🟢 5 | Phase 3-b/c (fixer + init) | 도입 마찰 감소 |
| 🟢 6 | Phase 4 (perf/obs) | 1.0 안정화 단계에서 진행 |

---

## 리스크 주의점

- `doctor` CLI는 oxlint 외부 툴이 됨 → 사용자 DX(두 개 실행) 부담. IDE 통합은 LSP 디자인 필요.
- per-file LRU 사이즈는 측정 기반 결정 필요 (너무 크면 메모리, 너무 작으면 이득 소실).
- 신규 룰은 FSD 스펙 해석 차이로 false positive 위험 — beta 플래그 + opt-in 기본.

---

## v1.0 마일스톤

**Phase 1 + Phase 2-a + Phase 3-a 완료 시점에 API freeze & 1.0 릴리즈.**

---

## 참고: 경쟁 도구 비교 요약

| 기준 | 우리 | @conarti | Steiger (공식) | eslint-plugin-boundaries |
|---|---|---|---|---|
| 런타임 | oxlint (Rust, 병렬) | ESLint (Node) | CLI 전용 | ESLint (Node) |
| 캐시 | WeakMap config + `segmentToLayer` O(1) + regex 3종 | 없음 | FS 인덱싱 1회 | `MatchersCache` |
| 룰 개수 | 7 | 3 | 20+ | 7 (일반) |
| tsconfig paths | `extends`/`references`/순환 탐지 자체 구현 | join만 | `parseNearestTsConfig` | 외부 리졸버 |
| type-only import | `allowTypeImports` 옵션 | 없음 | N/A | legacyImportKind |
| 테스트 | 28 fixture + smoke | 인라인 rule-tester | 8.6KB 단일 spec | 대규모 Jest suite |
