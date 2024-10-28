(define-trait gateway-trait
	(
		(call-contract ((string-ascii 32) (string-ascii 128) (buff 10240)) (response bool uint))
        (approve-messages ((buff 4096) (buff 16384)) (response bool uint))
        (validate-message ((string-ascii 32) (string-ascii 128) (string-ascii 128) (buff 32)) (response bool uint))
        (is-message-approved  ((string-ascii 32) (string-ascii 128) (string-ascii 128) principal (buff 32)) (response bool uint))
        (is-message-executed  ((string-ascii 32) (string-ascii 128)) (response bool uint))
        (rotate-signers ((buff 8192) (buff 16384)) (response bool uint))
	)
)

(define-trait gas-service-trait
	(
		(pay-native-gas-for-contract-call (uint principal (string-ascii 32) (string-ascii 128) (buff 10240) principal) (response bool uint))
        (add-native-gas (uint (buff 32) uint principal) (response bool uint))
	)
)