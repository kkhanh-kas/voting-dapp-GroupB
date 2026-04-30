/** 
deploy constructor
    → owner được set
    → 2 ứng viên mặc định được tạo
    → startTime / endTime được set

owner gọi addCandidate()
    → thêm ứng viên mới vào mapping
    → emit candidateAdded

owner gọi setVotingPeriod()
    → cập nhật startTime / endTime

người dùng gọi vote()
    → withinVotingPeriod check
    → chưa vote check
    → candidateId hợp lệ check
    → hasVoted[msg.sender] = true
    → voteCount++
    → emit votedEvent

frontend gọi getVotingStatus()
    → NOT_STARTED / ACTIVE / ENDED

frontend gọi candidates[id]
    → Solidity tự generate getter, không cần viết hàm
    → trả về { id, name, voteCount }

frontend gọi hasVoted[address]
    → true / false
  */


/// State Variables

/// Events

/// Modifiers

/// Constructor

/// Internal Function

/// Owner Functions

/// Vote Function

