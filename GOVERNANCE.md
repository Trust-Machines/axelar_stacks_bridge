# Governance

The Governance contract combines timelock execution and finalization logic with Axelar's message validation. It is responsible for managing contract-level updates for the Gateway and ITS contracts. 

##  Interface

### Execute

Schedules a task to be finalized at a later time. The `eta` p(execution time) specified in the payload must be greater than or equal to `current timestamp` + `MIN-TIMELOCK-DELAY` (43200/12 hours)) 

```clarity
(define-public (execute
    (gateway-impl <gateway-trait>)
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload (buff 64000))
)
```

**Payload Format for a Implementation Update**
```
{
  target: principal, ;; new implementation contract address
  proxy: principal, ;; address of the proxy contract that the update will be made on
  eta: uint, ;; unix timestamp in seconds
  type: u1  ;; update type
}
```

**Payload Format for a Governance Update**

```
{
  target: principal, ;; new governance contract address
  proxy: principal, ;; address of the proxy contract that the update will be made on
  eta: uint, ;; unix timestamp in seconds
  type: u2 ;; update type
}
```

### Finalize

Finalizes a previously scheduled task.

```clarity
(define-public (finalize
    (proxy <proxy-trait>)
    (payload (buff 64000))
)
```

### Cancel

Cancels a previously scheduled task immediately.

```clarity
(define-public (cancel
    (gateway-impl <gateway-trait>)
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload (buff 64000))
)
```

**Payload Format**

```
{
  hash: (buff 32), ;; payload hash of the task to be canceled
  type: u3 ;; cancellation type
}
```

