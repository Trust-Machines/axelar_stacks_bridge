(define-constant contract-code 
"(define-read-only (hi)\n  \"hi\"\n)\n")

(define-constant tx-version (if is-in-mainnet 0x00 0x80))

(define-constant curr-chain-id (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? chain-id)) u13 u17)))
(define-constant standard-auth-type 0x04)
(define-constant p2pkh-hash-mode 0x00)

(define-constant contract-code-buff (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? contract-code)) u5 u37)))
(define-constant pub-key-encoding 0x00)
(define-constant sig 0x00bbe24c6f9e5d3ecaa8452e0e03112e2e4e8276159972420198bf752634bfa9113886cd8a7bb8f02264040941be317ae11a6a576caf0ca9728e2e08b57bb280c0)
;; anchor mode any
(define-constant anchor-mode 0x03)
(define-constant post-conditions-mode-allow 0x01)
(define-constant post-conditions 0x00000000)
(define-constant versioned-smart-contract 0x06)
(define-constant clarity-version 0x03)
(define-constant contract-name
  (unwrap-panic (get name (unwrap-panic (principal-destruct? (as-contract tx-sender))))))
(define-constant contract-name-length 
  (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? (len contract-name))) u16 u17)))
(define-constant contract-name-buff (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? contract-name)) u5 (+ (len contract-name) u5))))
(define-constant contract-code-length 
  (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? (len contract-code))) u13 u17)))
(define-read-only (construct)
  contract-code-buff)




(define-constant tx-serialized (concat
  tx-version
  (concat curr-chain-id
    (concat 
      standard-auth-type
        (concat p2pkh-hash-mode
          (concat 
            (get hash-bytes (unwrap-panic (principal-destruct? tx-sender)))
            (concat 
              0x0000000000000000
              (concat
                0x0000000000002710
                (concat
                  pub-key-encoding
                  (concat
                    sig
                    (concat
                      anchor-mode
                      (concat
                        post-conditions-mode-allow
                        (concat 
                          post-conditions
                          (concat 
                            versioned-smart-contract
                            (concat
                              clarity-version
                              (concat
                                contract-name-length
                                (concat
                                  contract-name-buff
                                  (concat
                                    contract-code-length
                                    contract-code-buff))
                              ))))))))))))))))
(sha512/256 tx-serialized)
;; how can we get from here to there
(get-block-info? header-hash block-height)


