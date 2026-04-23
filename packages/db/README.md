# @deepfield/db

Cloudflare D1(SQLite)과 Drizzle 기반의 Deepfield DB 워크스페이스입니다. 현재 스키마는 게시글/유저/회원가입/로그인 테이블 없이 블로그 댓글, 대댓글, 조회수, 뉴스레터 기능만 독립적으로 다룹니다.

## Setup

```sh
cp packages/db/.env.example packages/db/.env
```

Drizzle Kit에서 D1 HTTP driver를 사용할 경우 Cloudflare 계정 ID, D1 database ID, API token을 설정합니다. migration SQL 생성만 할 때는 환경변수 없이도 동작합니다.

## Scripts

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

루트 스크립트는 `@deepfield/db` 워크스페이스로 위 명령을 위임합니다.

## Usage

```ts
import { createDb } from "@deepfield/db";

export default {
  async fetch(_request: Request, env: { DB: D1Database }) {
    const db = createDb(env.DB);
    const comments = await db.query.comments.findMany();

    return Response.json(comments);
  }
};
```

## Schema

- `comments`: 외부 글 식별자(`entryId`) 기준 댓글/대댓글을 저장합니다. `parentId`가 같은 테이블의 `id`를 참조하므로 별도 대댓글 테이블이 필요 없습니다.
- `postViewCounts`: 외부 글 식별자(`entryId`) 기준 조회수 집계 값을 저장합니다.
- `postViewEvents`: 조회 이벤트를 저장합니다. 유니크 조회수 계산이나 간단한 분석에 사용할 수 있습니다.
- `newsletterSubscribers`: 이메일 구독 상태와 확인/구독취소 토큰 해시를 저장합니다.
- `newsletterIssues`: 발송할 뉴스레터 이슈 메타데이터를 저장합니다.
- `newsletterDeliveries`: 이슈별 구독자 발송 상태와 실패/반송 정보를 저장합니다.
