# WalletWarden Backend Diagrams

These diagrams are based on the backend source: `app/main.py`, `app/api/`,
`app/models.py`, `app/schemas/`, `app/services/`, and `app/ai/`.

## Open in draw.io / diagrams.net

1. Open diagrams.net and create or open a diagram.
2. Choose **Arrange → Insert → Mermaid** (in some versions: **Insert → Advanced → Mermaid**).
3. Copy one complete Mermaid code block below, including its first `flowchart`,
   `classDiagram`, `erDiagram`, or `sequenceDiagram` line, into the editor.
4. Insert it, then repeat for each diagram. They are separate diagrams so each
   can be rearranged and styled independently.

The object view is expressed as a Mermaid flowchart because Mermaid does not
define a dedicated object-diagram syntax.

## 1. Class diagram

Shows the persisted SQLModel entities, the main Pydantic contracts, and the
backend's key service interfaces. Field and dependency associations reflect how
the current routes and services use those types; they are not Python ORM
relationship declarations.

```mermaid
classDiagram
    direction LR

    class User {
        +int id
        +str email
        +str password_hash
        +str display_name
        +bool roast_enabled
        +str roast_tone
    }
    class Category {
        +int id
        +int user_id
        +str name
        +str kind
        +str icon
        +bool is_default
    }
    class Transaction {
        +int id
        +int user_id
        +str kind
        +int amount
        +int category_id
        +date date
        +str note
    }
    class Budget {
        +int id
        +int user_id
        +str month
        +int category_id
        +int limit
    }
    class AIMessage {
        +int id
        +int user_id
        +str kind
        +str trigger_name
        +str tone
        +str category
        +str text
        +str provider
        +bool read
        +bool reported
        +str roast_key
        +datetime created_at
    }

    class TransactionCreate {
        +str kind
        +int amount
        +int category_id
        +date date
        +str note
    }
    class TransactionRead {
        +int id
        +str kind
        +int amount
        +int category_id
        +date date
        +str note
    }
    class BudgetUpdate {
        +str month
        +int total
        +CategoryBudgetIn[] categories
    }
    class BudgetStatus {
        +str month
        +BudgetLine total
        +BudgetLine[] categories
    }
    class FinancialSummary {
        +str month
        +int income
        +int expense
        +int balance
        +int total_budget
        +CategorySummary[] categories
        +ExpenseItem[] top_expenses
    }
    class RoastContext {
        +RoastTrigger trigger
        +Tone tone
        +str category
        +int amount
        +int spent
        +int days_left
    }
    class RoastCandidate {
        +str key
        +RoastContext context
    }
    class AIReply {
        +str text
        +str provider
        +bool fallback
        +int latency_ms
    }
    class AIService {
        <<protocol>>
        +advise(user_id, request) AIReply
        +roast(user_id, context) AIReply
        +monthly_report(user_id, summary) MonthlyReport
        +parse_entry(user_id, text, categories) ParsedEntry
        +health() dict
    }
    class DefaultAIService {
        +advise(user_id, request) AIReply
        +roast(user_id, context) AIReply
        +monthly_report(user_id, summary) MonthlyReport
        +parse_entry(user_id, text, categories) ParsedEntry
        +health() dict
        -_answer(task, user_id, messages) result
    }
    class detect_roast {
        <<pure function>>
        +detect_roast(new, recent, budgets, total_budget, tone, fired) RoastCandidate
    }
    class build_month_summary {
        <<service function>>
        +build_month_summary(session, user_id, month) FinancialSummary
    }

    User "1" --> "0..*" Category : owns
    User "1" --> "0..*" Transaction : owns
    User "1" --> "0..*" Budget : owns
    User "1" --> "0..*" AIMessage : owns
    Category "1" --> "0..*" Transaction : categorizes
    Category "0..1" --> "0..*" Budget : optional budget scope

    TransactionCreate ..> Transaction : validated input
    TransactionRead ..> Transaction : response projection
    BudgetUpdate ..> Budget : replaces month budgets
    BudgetStatus ..> Budget : computed status
    build_month_summary ..> FinancialSummary : computes
    detect_roast ..> RoastCandidate : selects
    RoastCandidate *-- RoastContext
    AIService <|.. DefaultAIService : implements
    DefaultAIService ..> AIReply : returns
    DefaultAIService ..> FinancialSummary : report input
    DefaultAIService ..> RoastContext : roast input
```

## 2. Component diagram

Shows runtime routing and dependency direction. The React build is served only
when `frontend/dist` exists; it is not part of API request handling.

```mermaid
flowchart LR
    Client["Browser / frontend"]
    FastAPI["FastAPI app<br/>app/main.py"]
    Auth["Auth router"]
    UserAPI["User settings router"]
    CategoryAPI["Categories router"]
    TxAPI["Transactions router"]
    BudgetAPI["Budgets router"]
    DashboardAPI["Dashboard router"]
    AIAPI["AI router"]
    Security["JWT + Argon2<br/>app/security.py"]
    Session["SQLModel Session<br/>app/db.py"]
    Services["Summary + budget services"]
    Trigger["Roast detector<br/>app.ai.detect_roast"]
    AIService["AIService protocol"]
    DefaultAI["DefaultAIService"]
    Providers["Configured providers<br/>llama.cpp / Gemini"]
    Rules["Rules fallback"]
    SQLite[("SQLite<br/>WAL + foreign keys")]
    Background["FastAPI BackgroundTasks"]
    SPA["React static build<br/>optional"]

    Client --> FastAPI
    FastAPI --> Auth
    FastAPI --> UserAPI
    FastAPI --> CategoryAPI
    FastAPI --> TxAPI
    FastAPI --> BudgetAPI
    FastAPI --> DashboardAPI
    FastAPI --> AIAPI
    FastAPI --> SPA

    Auth --> Security
    UserAPI --> Security
    CategoryAPI --> Security
    TxAPI --> Security
    BudgetAPI --> Security
    DashboardAPI --> Security
    AIAPI --> Security

    Auth --> Session
    UserAPI --> Session
    CategoryAPI --> Session
    TxAPI --> Session
    BudgetAPI --> Session
    DashboardAPI --> Session
    AIAPI --> Session
    Session --> SQLite

    BudgetAPI --> Services
    DashboardAPI --> Services
    AIAPI --> Services
    TxAPI --> Trigger
    TxAPI --> Background
    Background --> AIService
    AIAPI --> AIService
    AIService -. dependency resolves to .-> DefaultAI
    DefaultAI --> Providers
    DefaultAI --> Rules
    Background --> Session
```

## 3. ERD

Shows the five persisted tables and their foreign keys. A `budgets.category_id`
of `NULL` represents a whole-month budget; a non-null value scopes it to one
category.

```mermaid
erDiagram
    USERS {
        int id PK
        string email UK
        string password_hash
        string display_name
        boolean roast_enabled
        string roast_tone
    }
    CATEGORIES {
        int id PK
        int user_id FK
        string name
        string kind
        string icon
        boolean is_default
    }
    TRANSACTIONS {
        int id PK
        int user_id FK
        string kind
        int amount
        int category_id FK
        date date
        string note "nullable"
    }
    BUDGETS {
        int id PK
        int user_id FK
        string month
        int category_id FK "nullable for total"
        int limit
    }
    AI_MESSAGES {
        int id PK
        int user_id FK
        string kind
        string trigger
        string tone
        string category
        string text
        string provider
        boolean read
        boolean reported
        string roast_key "nullable, indexed"
        datetime created_at
    }

    USERS ||--o{ CATEGORIES : owns
    USERS ||--o{ TRANSACTIONS : records
    USERS ||--o{ BUDGETS : configures
    USERS ||--o{ AI_MESSAGES : receives
    CATEGORIES ||--o{ TRANSACTIONS : classifies
    CATEGORIES o|--o{ BUDGETS : scopes
```

## 4. Object diagram (example data snapshot)

This is an illustrative object graph for one user. Example values are not
pre-seeded database rows. Lines show the current ownership/category references.

```mermaid
flowchart LR
    user1["u1 : User<br/>id = 1<br/>email = alex@example.com<br/>roast_enabled = true<br/>roast_tone = honest"]
    category1["c1 : Category<br/>id = 1<br/>name = Ăn uống<br/>kind = expense"]
    transaction1["t17 : Transaction<br/>id = 17<br/>kind = expense<br/>amount = 45000 VND<br/>date = 2026-11-06<br/>note = Milk tea"]
    budget1["b8 : Budget<br/>id = 8<br/>month = 2026-11<br/>limit = 2500000 VND"]
    alert1["m3 : AIMessage<br/>id = 3<br/>trigger = repeat_today<br/>provider = fake<br/>read = false"]

    user1 -->|"owns"| category1
    user1 -->|"owns"| transaction1
    user1 -->|"owns"| budget1
    user1 -->|"owns"| alert1
    transaction1 -->|"category_id = 1"| category1
    budget1 -->|"category_id = 1"| category1
```

## 5. Sequence diagram: saving an expense and generating a roast

Roast detection is done after the transaction commit. The API response contains
`roast_pending`; the roast generation and alert persistence run as a background
task after the response is sent.

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant API as FastAPI / transactions router
    participant Auth as current_user / JWT
    participant DB as SQLite
    participant Detector as detect_roast
    participant Tasks as BackgroundTasks
    participant AI as AIService

    Client->>API: POST /api/transactions + Bearer token
    API->>Auth: Decode JWT and load user
    Auth->>DB: SELECT user by token subject
    DB-->>Auth: User
    Auth-->>API: Authenticated user
    API->>DB: Verify owned category and kind
    DB-->>API: Category
    API->>DB: INSERT transaction
    API->>DB: COMMIT transaction
    API->>DB: Load recent transactions, budgets, fired roast keys
    DB-->>API: User-scoped history and budgets
    alt Roast Mode is enabled and transaction is an expense
        API->>Detector: new TxRecord + recent + budgets + tone + fired keys
        Detector-->>API: RoastCandidate or none
    else Roast disabled or transaction is income
        API->>API: Skip roast detection
    end
    API-->>Client: 201 {transaction, roast_pending}
    opt RoastCandidate exists
        API->>Tasks: Schedule _run_roast(user_id, candidate, AIService)
        Tasks->>AI: roast(user_id, candidate.context)
        AI-->>Tasks: AIReply (provider or rules fallback)
        Tasks->>DB: INSERT AIMessage with roast_key
        DB-->>Tasks: COMMIT alert
    end
    Client->>API: GET /api/ai/alerts?unread=true
    API->>DB: SELECT unread alerts for authenticated user
    DB-->>API: RoastAlert[]
    API-->>Client: 200 RoastAlert[]
```

## 6. Flowchart: transaction request and roast decision

```mermaid
flowchart TD
    Start([POST /api/transactions])
    Validate["Validate request body"]
    Auth["Validate bearer JWT<br/>load authenticated user"]
    Category{"Category owned by user<br/>and kind matches?"}
    RejectCategory["Return 404 or 422"]
    Save["Insert transaction and commit"]
    Income{"Is expense and<br/>Roast Mode enabled?"}
    Skip["Do not schedule roast"]
    Gather["Load recent 35-day history,<br/>month budgets, fired roast keys"]
    Detect["detect_roast(new, recent, budgets, tone, fired)"]
    Candidate{"A new, unfired trigger?"}
    NoRoast["Return transaction<br/>roast_pending = false"]
    Response["Return transaction<br/>roast_pending = true"]
    Background["Background task calls AIService.roast"]
    Provider{"Configured model returns<br/>valid output?"}
    Fallback["Use rules fallback"]
    Alert["Persist AIMessage and roast_key"]
    Done([Alert available from GET /api/ai/alerts])

    Start --> Validate --> Auth --> Category
    Category -- No --> RejectCategory
    Category -- Yes --> Save --> Income
    Income -- No --> Skip --> NoRoast
    Income -- Yes --> Gather --> Detect --> Candidate
    Candidate -- No --> NoRoast
    Candidate -- Yes --> Response --> Background --> Provider
    Provider -- Yes --> Alert
    Provider -- No --> Fallback --> Alert
    Alert --> Done
```
