(define-trait gateway-trait
	(
		(call-contract ((string-ascii 32) (string-ascii 48) (buff 10240)) (response bool uint))
        (approve-messages ((buff 4096) (buff 7168)) (response bool uint))
        (validate-message ((string-ascii 32) (string-ascii 71) (string-ascii 48) (buff 32)) (response bool uint))
        (is-message-approved  ((string-ascii 32) (string-ascii 71) (string-ascii 48) principal (buff 32)) (response bool uint))
        (is-message-executed  ((string-ascii 32) (string-ascii 71)) (response bool uint))
        (rotate-signers ((buff 4096) (buff 7168)) (response bool uint))
	)
)
