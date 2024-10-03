(define-trait gateway-trait
	(
		(call-contract ((buff 18) (buff 96) (buff 4096)) (response bool uint))
        (approve-messages ((buff 4096) (buff 4096)) (response bool uint))
        (validate-message ((buff 18) (buff 32) (buff 96) (buff 32)) (response bool uint))
        (is-message-approved  ((buff 18) (buff 32) (buff 96) (buff 96) (buff 32)) (response bool uint))
        (is-message-executed  ((buff 18) (buff 32)) (response bool uint))
        (rotate-signers ((buff 4096) (buff 4096)) (response bool uint))
	)
)
