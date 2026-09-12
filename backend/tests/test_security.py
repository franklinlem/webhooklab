from app.security import hash_token, ip_hint, mask_headers


def test_token_hash_is_stable_and_secret_dependent():
    assert hash_token("abc", "x" * 32) == hash_token("abc", "x" * 32)
    assert hash_token("abc", "x" * 32) != hash_token("abc", "y" * 32)


def test_sensitive_headers_are_masked_case_insensitively():
    result = mask_headers({"Authorization": "Bearer secret", "Content-Type": "application/json"})
    assert result["Authorization"] == "••••••••"
    assert result["Content-Type"] == "application/json"


def test_ip_is_coarsened():
    assert ip_hint("192.168.1.42") == "192.168.1.0/24"
    assert ip_hint("2001:db8:abcd:12::1") == "2001:db8:abcd:12::/64"

