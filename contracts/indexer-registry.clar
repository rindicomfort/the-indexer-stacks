;; title: indexer-registry
;; version: 1.0.0
;; summary: A decentralized indexer registry and query protocol on the Stacks blockchain.
;; description: Allows indexers to register, stake STX, accept indexing queries, submit results, and build reputation.

;; traits
;; None

;; constants
(define-constant CONTRACT-OWNER tx-sender)

;; error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-REGISTERED (err u101))
(define-constant ERR-NOT-REGISTERED (err u102))
(define-constant ERR-INSUFFICIENT-STAKE (err u103))
(define-constant ERR-INSUFFICIENT-FUNDS (err u104))
(define-constant ERR-QUERY-NOT-FOUND (err u105))
(define-constant ERR-QUERY-COMPLETED (err u106))
(define-constant ERR-INVALID-RESPONDER (err u107))
(define-constant ERR-NOT-REQUESTER (err u108))
(define-constant ERR-STAKE-LOCKED (err u109))

;; configuration variables
(define-data-var minimum-stake uint u100000000) ;; 100 STX in micro-STX
(define-data-var slash-penalty uint u50000000)   ;; 50 STX slash penalty

;; registry data variables
(define-data-var next-query-id uint u1)
(define-data-var total-indexers uint u0)

;; data maps
(define-map Indexers
    principal
    {
        endpoint: (string-utf8 256),
        stake: uint,
        active: bool,
        rating: uint,
        registered-at: uint
    }
)

(define-map IndexerScores
    principal
    {
        positive-votes: uint,
        negative-votes: uint
    }
)

(define-map Queries
    uint
    {
        requester: principal,
        query-hash: (buff 32),
        reward: uint,
        responder: (optional principal),
        response-hash: (optional (buff 32)),
        status: (string-ascii 16) ;; "pending", "responded", "completed", "disputed"
    }
)

;; public functions

;; Register as an Indexer with a minimum STX stake
(define-public (register-indexer (endpoint (string-utf8 256)) (stake-amount uint))
    (let
        (
            (existing-indexer (map-get? Indexers tx-sender))
            (min-stake (var-get minimum-stake))
        )
        ;; Check if already registered
        (asserts! (is-none existing-indexer) ERR-ALREADY-REGISTERED)
        ;; Check if stake amount meets the minimum required stake
        (asserts! (>= stake-amount min-stake) ERR-INSUFFICIENT-STAKE)
        
        ;; Transfer STX stake to contract
        (try! (stx-transfer? stake-amount tx-sender (as-contract tx-sender)))
        
        ;; Register indexer details
        (map-set Indexers tx-sender {
            endpoint: endpoint,
            stake: stake-amount,
            active: true,
            rating: u100, ;; Initial rating out of 100
            registered-at: block-height
        })
        
        ;; Initialize score
        (map-set IndexerScores tx-sender {
            positive-votes: u0,
            negative-votes: u0
        })
        
        (var-set total-indexers (+ (var-get total-indexers) u1))
        (ok true)
    )
)

;; Update endpoint URL
(define-public (update-endpoint (new-endpoint (string-utf8 256)))
    (let
        (
            (indexer-info (unwrap! (map-get? Indexers tx-sender) ERR-NOT-REGISTERED))
        )
        (map-set Indexers tx-sender (merge indexer-info { endpoint: new-endpoint }))
        (ok true)
    )
)

;; De-register and reclaim stake (only if active and not locked)
(define-public (deregister-indexer)
    (let
        (
            (indexer-info (unwrap! (map-get? Indexers tx-sender) ERR-NOT-REGISTERED))
            (staked-amount (get stake indexer-info))
        )
        (asserts! (get active indexer-info) ERR-NOT-REGISTERED)
        
        ;; Refund the stake back to the indexer
        (try! (as-contract (stx-transfer? staked-amount (as-contract tx-sender) tx-sender)))
        
        ;; Update map to inactive and zero stake
        (map-set Indexers tx-sender (merge indexer-info {
            active: false,
            stake: u0
        }))
        
        (var-set total-indexers (- (var-get total-indexers) u1))
        (ok true)
    )
)

;; Request an indexing query by locking a reward
(define-public (request-query (query-hash (buff 32)) (reward-amount uint))
    (let
        (
            (query-id (var-get next-query-id))
        )
        ;; Lock the reward in the contract
        (try! (stx-transfer? reward-amount tx-sender (as-contract tx-sender)))
        
        ;; Record the query
        (map-set Queries query-id {
            requester: tx-sender,
            query-hash: query-hash,
            reward: reward-amount,
            responder: none,
            response-hash: none,
            status: "pending"
        })
        
        (var-set next-query-id (+ query-id u1))
        (ok query-id)
    )
)

;; Submit an indexer response for a query
(define-public (submit-response (query-id uint) (response-hash (buff 32)))
    (let
        (
            (query-info (unwrap! (map-get? Queries query-id) ERR-QUERY-NOT-FOUND))
            (indexer-info (unwrap! (map-get? Indexers tx-sender) ERR-NOT-REGISTERED))
        )
        ;; Indexer must be active
        (asserts! (get active indexer-info) ERR-NOT-REGISTERED)
        ;; Query must be pending
        (asserts! (is-eq (get status query-info) "pending") ERR-QUERY-COMPLETED)
        
        ;; Save responder details
        (map-set Queries query-id (merge query-info {
            responder: (some tx-sender),
            response-hash: (some response-hash),
            status: "responded"
        }))
        
        (ok true)
    )
)

;; Finalize a query, transferring reward to responder and voting on performance
(define-public (finalize-query (query-id uint) (approved bool))
    (let
        (
            (query-info (unwrap! (map-get? Queries query-id) ERR-QUERY-NOT-FOUND))
            (responder-principal (unwrap! (get responder query-info) ERR-INVALID-RESPONDER))
            (reward-amount (get reward query-info))
        )
        ;; Only the original requester can finalize
        (asserts! (is-eq tx-sender (get requester query-info)) ERR-NOT-REQUESTER)
        ;; Query must be in "responded" status
        (asserts! (is-eq (get status query-info) "responded") ERR-QUERY-COMPLETED)
        
        (if approved
            (begin
                ;; Transfer reward to responder
                (try! (as-contract (stx-transfer? reward-amount (as-contract tx-sender) responder-principal)))
                ;; Record positive rating vote
                (let
                    (
                        (scores (default-to { positive-votes: u0, negative-votes: u0 } (map-get? IndexerScores responder-principal)))
                    )
                    (map-set IndexerScores responder-principal (merge scores {
                        positive-votes: (+ (get positive-votes scores) u1)
                    }))
                )
                ;; Mark completed
                (map-set Queries query-id (merge query-info { status: "completed" }))
            )
            (begin
                ;; Refund reward back to requester
                (try! (as-contract (stx-transfer? reward-amount (as-contract tx-sender) tx-sender)))
                ;; Record negative rating vote
                (let
                    (
                        (scores (default-to { positive-votes: u0, negative-votes: u0 } (map-get? IndexerScores responder-principal)))
                    )
                    (map-set IndexerScores responder-principal (merge scores {
                        negative-votes: (+ (get negative-votes scores) u1)
                    }))
                )
                ;; Mark disputed
                (map-set Queries query-id (merge query-info { status: "disputed" }))
            )
        )
        (ok true)
    )
)

;; Slash a malicious or offline indexer (Owner Only)
(define-public (slash-indexer (indexer principal))
    (let
        (
            (indexer-info (unwrap! (map-get? Indexers indexer) ERR-NOT-REGISTERED))
            (staked-amount (get stake indexer-info))
            (penalty (var-get slash-penalty))
            (burn-amount (if (>= staked-amount penalty) penalty staked-amount))
        )
        ;; Owner check
        (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
        (asserts! (get active indexer-info) ERR-NOT-REGISTERED)
        
        ;; Burn the slashed amount (transfer to owner, or we could burn it. Sending to burn address or contract owner is standard)
        (try! (as-contract (stx-transfer? burn-amount (as-contract tx-sender) CONTRACT-OWNER)))
        
        ;; Set indexer to inactive and reduce stake
        (map-set Indexers indexer (merge indexer-info {
            active: false,
            stake: (- staked-amount burn-amount)
        }))
        
        (var-set total-indexers (- (var-get total-indexers) u1))
        (ok true)
    )
)

;; read only functions

(define-read-only (get-indexer-info (indexer principal))
    (map-get? Indexers indexer)
)

(define-read-only (get-indexer-score (indexer principal))
    (map-get? IndexerScores indexer)
)

(define-read-only (get-query-info (query-id uint))
    (map-get? Queries query-id)
)

(define-read-only (get-minimum-stake)
    (ok (var-get minimum-stake))
)

(define-read-only (get-slash-penalty)
    (ok (var-get slash-penalty))
)

(define-read-only (get-total-indexers)
    (ok (var-get total-indexers))
)

